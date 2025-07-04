import { ref, computed } from 'vue';

export interface VoiceMode {
  type: 'manual' | 'continuous';
  vadThreshold?: number;
  minSpeechDuration?: number;
  minSilenceDuration?: number;
  maxSpeechDuration?: number;
  speechPad?: number;
  samplesOverlap?: number;
}

export interface AudioRecordingState {
  isRecording: boolean;
  isProcessing: boolean;
  isSpeechDetected: boolean;
  currentMode: VoiceMode;
  audioBlob: Blob | null;
  transcription: string;
  error: string | null;
}

export interface TranscriptionResult {
  text: string;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
}

class AudioRecordingService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
  private audioChunks: Blob[] = [];
  private vadTimer: number | null = null;
  private silenceTimer: number | null = null;
  private speechDetectionTimer: number | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  
  // Speech detection state
  private speechStartTime: number | null = null;
  private lastSpeechTime: number = 0;
  private silenceStartTime: number | null = null;
  private hasDetectedSpeech: boolean = false;
  
  // Reactive state
  public state = ref<AudioRecordingState>({
    isRecording: false,
    isProcessing: false,
    isSpeechDetected: false,
    currentMode: { type: 'manual' },
    audioBlob: null,
    transcription: '',
    error: null
  });

  // Computed properties for easy access
  public isRecording = computed(() => this.state.value.isRecording);
  public isProcessing = computed(() => this.state.value.isProcessing);
  public isSpeechDetected = computed(() => this.state.value.isSpeechDetected);
  public transcription = computed(() => this.state.value.transcription);
  public error = computed(() => this.state.value.error);

  // Event callbacks
  private onTranscription: ((text: string) => void) | null = null;
  private onAutoSubmit: ((text: string) => void) | null = null;
  private onError: ((error: string) => void) | null = null;

  constructor() {
    this.setupDefaultMode();
  }

  private setupDefaultMode() {
    this.state.value.currentMode = {
      type: 'manual',
      vadThreshold: 0.5,
      minSpeechDuration: 250,
      minSilenceDuration: 1200, // 1.2s for auto-send in continuous mode
      maxSpeechDuration: 30,
      speechPad: 200,
      samplesOverlap: 0.1
    };
  }

  public setCallbacks(callbacks: {
    onTranscription?: (text: string) => void;
    onAutoSubmit?: (text: string) => void;
    onError?: (error: string) => void;
  }) {
    this.onTranscription = callbacks.onTranscription || null;
    this.onAutoSubmit = callbacks.onAutoSubmit || null;
    this.onError = callbacks.onError || null;
  }

  public setVoiceMode(mode: VoiceMode) {
    this.state.value.currentMode = {
      ...this.state.value.currentMode,
      ...mode
    };
  }

  public async initializeAudio(): Promise<boolean> {
    try {
      this.state.value.error = null;
      
      // Request microphone permission
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        }
      });

      return true;
    } catch (error) {
      this.state.value.error = `Failed to access microphone: ${error}`;
      console.error('Audio initialization failed:', error);
      if (this.onError) this.onError(this.state.value.error);
      return false;
    }
  }

  public async startRecording(mode?: VoiceMode): Promise<boolean> {
    if (mode) {
      this.setVoiceMode(mode);
    }

    if (!this.audioStream && !(await this.initializeAudio())) {
      return false;
    }

    try {
      this.audioChunks = [];
      this.state.value.isRecording = true;
      this.state.value.error = null;
      this.state.value.transcription = '';
      this.hasDetectedSpeech = false;
      this.speechStartTime = null;
      this.lastSpeechTime = 0;
      this.silenceStartTime = null;

      // Create MediaRecorder
      this.mediaRecorder = new MediaRecorder(this.audioStream!, {
        mimeType: 'audio/webm;codecs=opus'
      });

      // Set up event handlers
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.handleRecordingStop();
      };

      // Start recording
      this.mediaRecorder.start(100); // Collect data every 100ms

      // Set up continuous mode if specified
      if (this.state.value.currentMode.type === 'continuous') {
        this.setupContinuousMode();
      }

      return true;
    } catch (error) {
      this.state.value.error = `Failed to start recording: ${error}`;
      this.state.value.isRecording = false;
      console.error('Recording start failed:', error);
      if (this.onError) this.onError(this.state.value.error);
      return false;
    }
  }

  public async stopRecording(): Promise<void> {
    if (this.mediaRecorder && this.state.value.isRecording) {
      this.mediaRecorder.stop();
      this.state.value.isRecording = false;
      this.cleanupContinuousMode();
    }
  }

  private async handleRecordingStop(): Promise<void> {
    if (this.audioChunks.length === 0) {
      this.state.value.error = 'No audio data recorded';
      if (this.onError) this.onError(this.state.value.error);
      return;
    }

    // Create audio blob
    this.state.value.audioBlob = new Blob(this.audioChunks, { type: 'audio/webm;codecs=opus' });
    
    // Process the audio
    await this.processAudio();
  }

  private async processAudio(): Promise<void> {
    if (!this.state.value.audioBlob) {
      this.state.value.error = 'No audio data to process';
      if (this.onError) this.onError(this.state.value.error);
      return;
    }

    try {
      this.state.value.isProcessing = true;
      this.state.value.error = null;

      // Convert blob to form data
      const formData = new FormData();
      formData.append('audio', this.state.value.audioBlob, 'recording.webm');
      formData.append('mode', this.state.value.currentMode.type);
      
      // Add VAD parameters
      if (this.state.value.currentMode.vadThreshold !== undefined) {
        formData.append('vad_threshold', this.state.value.currentMode.vadThreshold.toString());
      }
      if (this.state.value.currentMode.minSpeechDuration !== undefined) {
        formData.append('min_speech_duration', this.state.value.currentMode.minSpeechDuration.toString());
      }
      if (this.state.value.currentMode.minSilenceDuration !== undefined) {
        formData.append('min_silence_duration', this.state.value.currentMode.minSilenceDuration.toString());
      }
      if (this.state.value.currentMode.maxSpeechDuration !== undefined) {
        formData.append('max_speech_duration', this.state.value.currentMode.maxSpeechDuration.toString());
      }
      if (this.state.value.currentMode.speechPad !== undefined) {
        formData.append('speech_pad', this.state.value.currentMode.speechPad.toString());
      }

      // Send to backend for processing
      const response = await fetch('http://localhost:5050/api/transcribe-audio', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: TranscriptionResult = await response.json();
      this.state.value.transcription = result.text;

      // Trigger callbacks
      if (this.onTranscription) {
        this.onTranscription(result.text);
      }

      // Auto-submit in continuous mode
      if (this.state.value.currentMode.type === 'continuous' && result.text.trim()) {
        if (this.onAutoSubmit) {
          this.onAutoSubmit(result.text);
        }
        // Clear transcription after auto-submit
        setTimeout(() => {
          this.state.value.transcription = '';
        }, 500);
      }

    } catch (error) {
      this.state.value.error = `Transcription failed: ${error}`;
      console.error('Audio processing failed:', error);
      if (this.onError) this.onError(this.state.value.error);
    } finally {
      this.state.value.isProcessing = false;
    }
  }

  private setupContinuousMode(): void {
    if (!this.audioStream) return;

    try {
      // Create audio context for VAD
      this.audioContext = new AudioContext({ sampleRate: 16000 });
      this.source = this.audioContext.createMediaStreamSource(this.audioStream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.processor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        const currentTime = Date.now();
        
        // Simple energy-based VAD
        const energy = this.calculateAudioEnergy(inputData);
        const threshold = this.state.value.currentMode.vadThreshold || 0.5;
        
        const isSpeech = energy > threshold;
        this.state.value.isSpeechDetected = isSpeech;

        if (isSpeech) {
          this.lastSpeechTime = currentTime;
          this.hasDetectedSpeech = true;
          
          if (!this.speechStartTime) {
            this.speechStartTime = currentTime;
            console.log('Speech started');
          }
          
          if (this.silenceStartTime) {
            this.silenceStartTime = null; // Reset silence timer
          }

          // Check for maximum speech duration
          const maxSpeechMs = (this.state.value.currentMode.maxSpeechDuration || 30) * 1000;
          if (currentTime - this.speechStartTime > maxSpeechMs) {
            console.log('Max speech duration reached');
            this.handleContinuousStop('max_speech_duration');
          }
        } else {
          // Silence detected
          if (!this.silenceStartTime && this.speechStartTime && this.hasDetectedSpeech) {
            this.silenceStartTime = currentTime;
            console.log('Silence started');
          }

          // Check if we've been silent long enough to stop
          const minSilenceMs = this.state.value.currentMode.minSilenceDuration || 1200;
          if (this.silenceStartTime && currentTime - this.silenceStartTime > minSilenceMs && this.speechStartTime) {
            const speechDurationMs = this.lastSpeechTime - this.speechStartTime;
            const minSpeechMs = this.state.value.currentMode.minSpeechDuration || 250;
            
            if (speechDurationMs > minSpeechMs) {
              console.log(`Auto-stopping after ${minSilenceMs}ms of silence`);
              this.handleContinuousStop('silence_detected');
            }
          }
        }
      };

      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

    } catch (error) {
      console.error('Failed to setup continuous mode:', error);
      this.state.value.error = 'Failed to setup continuous mode';
      if (this.onError) this.onError(this.state.value.error);
    }
  }

  private calculateAudioEnergy(samples: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i];
    }
    return Math.sqrt(sum / samples.length);
  }

  private async handleContinuousStop(reason: string): Promise<void> {
    console.log(`Continuous recording stopped: ${reason}`);
    await this.stopRecording();
  }

  private cleanupContinuousMode(): void {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  private cleanupTimers(): void {
    if (this.vadTimer) {
      clearTimeout(this.vadTimer);
      this.vadTimer = null;
    }
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.speechDetectionTimer) {
      clearTimeout(this.speechDetectionTimer);
      this.speechDetectionTimer = null;
    }
  }

  public cleanup(): void {
    this.cleanupTimers();
    this.cleanupContinuousMode();
    
    if (this.mediaRecorder && this.state.value.isRecording) {
      this.mediaRecorder.stop();
    }
    
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }

    this.state.value.isRecording = false;
    this.state.value.isProcessing = false;
    this.state.value.isSpeechDetected = false;
  }

  public reset(): void {
    // Complete cleanup including audio context and all resources
    this.cleanup();
    
    // Clear all audio data
    this.audioChunks = [];
    this.state.value.audioBlob = null;
    this.state.value.transcription = '';
    this.state.value.error = null;
    
    // Close and reset audio context
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    // Reset all internal state
    this.mediaRecorder = null;
    this.processor = null;
    this.source = null;
    this.speechStartTime = null;
    this.lastSpeechTime = 0;
    this.silenceStartTime = null;
    this.hasDetectedSpeech = false;
    
    console.log('AudioService: Complete reset performed');
  }

  public clearTranscription(): void {
    this.state.value.transcription = '';
    this.state.value.error = null;
  }

  public clearError(): void {
    this.state.value.error = null;
  }

  public getAudioBlob(): Blob | null {
    return this.state.value.audioBlob;
  }
}

// Export singleton instance
export const audioService = new AudioRecordingService();
export default audioService;