import { ref, computed } from 'vue';

export interface VoiceMode {
  type: 'manual' | 'continuous';
  vadThreshold?: number;
  minSpeechDuration?: number;
  minSilenceDuration?: number;
  maxSpeechDuration?: number;
  speechPad?: number;
  samplesOverlap?: number;
  autoResume?: boolean; // Auto-resume after processing
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
  
  // Dual recorder approach for seamless audio
  private chunkTimer: number | null = null;
  private primaryRecorder: MediaRecorder | null = null;
  private secondaryRecorder: MediaRecorder | null = null;
  private primaryChunks: Blob[] = [];
  private secondaryChunks: Blob[] = [];
  private activeSide: 'primary' | 'secondary' = 'primary';
  private manualStop: boolean = false;
  private processingQueue: Promise<void> = Promise.resolve();
  
  // Speech detection state
  private speechStartTime: number | null = null;
  private lastSpeechTime: number = 0;
  private silenceStartTime: number | null = null;
  private hasDetectedSpeech: boolean = false;
  
  // Enhanced VAD state
  private energyHistory: number[] = [];
  private backgroundNoiseLevel: number = 0;
  private adaptiveThreshold: number = 0.5;
  private conversationPauseStart: number | null = null;
  private speechSegments: Array<{start: number, end: number, energy: number}> = [];
  
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
      minSilenceDuration: 1500, // 1.5s for natural conversation pauses
      maxSpeechDuration: 30,
      speechPad: 200,
      samplesOverlap: 0.1,
      autoResume: true // Auto-resume after processing in continuous mode
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
      this.manualStop = false; // Reset manual stop flag when starting

      if (this.state.value.currentMode.type === 'continuous') {
        // Continuous mode: use dual recorder approach
        this.setupDualRecording();
      } else {
        // Manual mode: traditional approach
        this.mediaRecorder = new MediaRecorder(this.audioStream!, {
          mimeType: 'audio/webm;codecs=opus'
        });

        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            this.audioChunks.push(event.data);
          }
        };

        this.mediaRecorder.onstop = () => {
          this.handleRecordingStop();
        };

        this.mediaRecorder.start(100);
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
    if (this.state.value.isRecording) {
      // Set manual stop flag
      this.manualStop = true;
      
      // Clear chunk timer first
      if (this.chunkTimer) {
        clearInterval(this.chunkTimer);
        this.chunkTimer = null;
      }
      
      // Stop the appropriate recorders
      if (this.state.value.currentMode.type === 'continuous') {
        if (this.primaryRecorder) {
          try { this.primaryRecorder.stop(); } catch (e) {}
          this.primaryRecorder = null;
        }
        if (this.secondaryRecorder) {
          try { this.secondaryRecorder.stop(); } catch (e) {}
          this.secondaryRecorder = null;
        }
        this.primaryChunks = [];
        this.secondaryChunks = [];
      } else if (this.mediaRecorder) {
        this.mediaRecorder.stop();
      }
      
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
        
        // Auto-resume recording for continuous conversation
        if (this.state.value.currentMode.autoResume) {
          this.autoResumeRecording();
        }
      }

    } catch (error) {
      this.state.value.error = `Transcription failed: ${error}`;
      console.error('Audio processing failed:', error);
      if (this.onError) this.onError(this.state.value.error);
    } finally {
      this.state.value.isProcessing = false;
    }
  }

  private setupDualRecording(): void {
    // Create two recorders that will alternate
    this.primaryRecorder = new MediaRecorder(this.audioStream!, {
      mimeType: 'audio/webm;codecs=opus'
    });
    
    this.secondaryRecorder = new MediaRecorder(this.audioStream!, {
      mimeType: 'audio/webm;codecs=opus'
    });

    // Set up data handlers
    this.primaryRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.primaryChunks.push(event.data);
      }
    };

    this.secondaryRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.secondaryChunks.push(event.data);
      }
    };

    // Set up stop handlers to process audio
    this.primaryRecorder.onstop = () => {
      this.processRecorderChunks('primary');
    };

    this.secondaryRecorder.onstop = () => {
      this.processRecorderChunks('secondary');
    };

    // Start with primary recorder
    this.primaryRecorder.start(100);
    this.activeSide = 'primary';
    
    // Set up alternating pattern
    this.setupAlternatingRecording();
  }

  private setupAlternatingRecording(): void {
    // Every 2 seconds, switch recorders with overlap
    this.chunkTimer = setInterval(async () => {
      if (this.state.value.isRecording && !this.manualStop) {
        await this.switchRecorders();
      }
    }, 2000) as unknown as number;
  }

  private async switchRecorders(): Promise<void> {
    if (this.manualStop) return;

    try {
      if (this.activeSide === 'primary' && this.primaryRecorder && this.secondaryRecorder) {
        // Start secondary before stopping primary (overlap)
        this.secondaryRecorder.start(100);
        
        // Wait a bit for overlap
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Stop primary
        this.primaryRecorder.stop();
        this.activeSide = 'secondary';
        
      } else if (this.activeSide === 'secondary' && this.primaryRecorder && this.secondaryRecorder) {
        // Start primary before stopping secondary (overlap)
        this.primaryRecorder.start(100);
        
        // Wait a bit for overlap
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Stop secondary
        this.secondaryRecorder.stop();
        this.activeSide = 'primary';
      }
    } catch (error) {
      console.warn('Recorder switch error:', error);
    }
  }

  private async processRecorderChunks(side: 'primary' | 'secondary'): Promise<void> {
    // Queue processing to avoid race conditions
    this.processingQueue = this.processingQueue.then(async () => {
      const chunks = side === 'primary' ? this.primaryChunks : this.secondaryChunks;
      
      if (chunks.length === 0) return;

      try {
        const audioBlob = new Blob(chunks, { type: 'audio/webm;codecs=opus' });
        
        // Clear chunks for next recording
        if (side === 'primary') {
          this.primaryChunks = [];
        } else {
          this.secondaryChunks = [];
        }
        
        // Send for transcription
        const formData = new FormData();
        formData.append('audio', audioBlob, 'chunk.webm');
        formData.append('mode', 'manual');

        const response = await fetch('http://localhost:5050/api/transcribe-audio', {
          method: 'POST',
          body: formData
        });

        if (response.ok) {
          const result: TranscriptionResult = await response.json();
          if (result.text.trim()) {
            this.state.value.transcription = result.text;
            
            if (this.onTranscription) {
              this.onTranscription(result.text);
            }
          }
        }
      } catch (error) {
        console.warn('Chunk processing error:', error);
      }
    });
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
        
        // Enhanced VAD with adaptive threshold
        const energy = this.calculateAudioEnergy(inputData);
        const spectralCentroid = this.calculateSpectralCentroid(inputData);
        const zeroCrossingRate = this.calculateZeroCrossingRate(inputData);
        
        // Update energy history for background noise estimation
        this.updateEnergyHistory(energy);
        
        // Use multiple features for better speech detection
        const isSpeech = this.detectSpeech(energy, spectralCentroid, zeroCrossingRate);
        this.state.value.isSpeechDetected = isSpeech;

        if (isSpeech) {
          this.lastSpeechTime = currentTime;
          this.hasDetectedSpeech = true;
          
          if (!this.speechStartTime) {
            this.speechStartTime = currentTime;
            console.log('Enhanced VAD: Speech started');
          }
          
          // Reset silence timers
          if (this.silenceStartTime) {
            this.silenceStartTime = null;
          }
          if (this.conversationPauseStart) {
            this.conversationPauseStart = null;
          }

          // Check for maximum speech duration
          const maxSpeechMs = (this.state.value.currentMode.maxSpeechDuration || 30) * 1000;
          if (currentTime - this.speechStartTime > maxSpeechMs) {
            console.log('Enhanced VAD: Max speech duration reached');
            this.handleContinuousStop('max_speech_duration');
          }
        } else {
          // Silence detected - determine if it's a natural pause or conversation end
          if (!this.silenceStartTime && this.speechStartTime && this.hasDetectedSpeech) {
            this.silenceStartTime = currentTime;
            console.log('Enhanced VAD: Silence started');
          }

          // Check for natural conversation pause
          if (this.silenceStartTime && currentTime - this.silenceStartTime > 800) { // 0.8s for natural pause detection
            if (!this.conversationPauseStart) {
              this.conversationPauseStart = currentTime;
              console.log('Enhanced VAD: Natural pause detected');
            }
          }

          // Check if we've been silent long enough to stop
          const minSilenceMs = this.state.value.currentMode.minSilenceDuration || 1500;
          if (this.conversationPauseStart && currentTime - this.conversationPauseStart > minSilenceMs && this.speechStartTime) {
            const speechDurationMs = this.lastSpeechTime - this.speechStartTime;
            const minSpeechMs = this.state.value.currentMode.minSpeechDuration || 250;
            
            if (speechDurationMs > minSpeechMs) {
              console.log(`Enhanced VAD: Auto-stopping after ${minSilenceMs}ms conversation pause`);
              this.handleContinuousStop('conversation_pause');
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

  private calculateSpectralCentroid(samples: Float32Array): number {
    // Simplified spectral centroid calculation
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < samples.length; i++) {
      const magnitude = Math.abs(samples[i]);
      numerator += i * magnitude;
      denominator += magnitude;
    }
    
    return denominator > 0 ? numerator / denominator : 0;
  }

  private calculateZeroCrossingRate(samples: Float32Array): number {
    let crossings = 0;
    
    for (let i = 1; i < samples.length; i++) {
      if ((samples[i] >= 0) !== (samples[i - 1] >= 0)) {
        crossings++;
      }
    }
    
    return crossings / samples.length;
  }

  private updateEnergyHistory(energy: number): void {
    this.energyHistory.push(energy);
    
    // Keep only last 100 samples for background noise estimation
    if (this.energyHistory.length > 100) {
      this.energyHistory.shift();
    }
    
    // Update background noise level (10th percentile of energy history)
    if (this.energyHistory.length >= 20) {
      const sortedEnergy = [...this.energyHistory].sort((a, b) => a - b);
      this.backgroundNoiseLevel = sortedEnergy[Math.floor(sortedEnergy.length * 0.1)];
      
      // Adaptive threshold: background noise + margin
      this.adaptiveThreshold = Math.max(0.01, this.backgroundNoiseLevel * 3);
    }
  }

  private detectSpeech(energy: number, spectralCentroid: number, zeroCrossingRate: number): boolean {
    // Use adaptive threshold based on background noise
    const energyThreshold = this.adaptiveThreshold;
    
    // Energy-based detection
    const hasEnergy = energy > energyThreshold;
    
    // Spectral features for better speech detection
    const hasVoiceSpectrum = spectralCentroid > 0.1 && spectralCentroid < 0.8;
    const hasVoiceZCR = zeroCrossingRate > 0.02 && zeroCrossingRate < 0.3;
    
    // Combine features for robust detection
    return hasEnergy && hasVoiceSpectrum && hasVoiceZCR;
  }

  // Removed addSilencePadding - using duration-based chunking instead

  private async handleContinuousStop(reason: string): Promise<void> {
    console.log(`Enhanced VAD: Continuous recording stopped: ${reason}`);
    await this.stopRecording();
  }

  private async autoResumeRecording(): Promise<void> {
    // Wait a moment for the UI to update and any TTS to start
    setTimeout(async () => {
      if (this.state.value.currentMode.type === 'continuous' && this.state.value.currentMode.autoResume) {
        console.log('Enhanced VAD: Auto-resuming recording for continuous conversation');
        await this.startRecording(this.state.value.currentMode);
      }
    }, 1000); // 1 second delay to allow for natural conversation flow
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
    if (this.chunkTimer) {
      clearInterval(this.chunkTimer);
      this.chunkTimer = null;
    }
  }

  public cleanup(): void {
    this.cleanupTimers();
    this.cleanupContinuousMode();
    
    if (this.primaryRecorder) {
      try { this.primaryRecorder.stop(); } catch (e) {}
      this.primaryRecorder = null;
    }
    
    if (this.secondaryRecorder) {
      try { this.secondaryRecorder.stop(); } catch (e) {}
      this.secondaryRecorder = null;
    }
    
    if (this.mediaRecorder && this.state.value.isRecording) {
      this.mediaRecorder.stop();
    }
    
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }

    this.primaryChunks = [];
    this.secondaryChunks = [];
    this.state.value.isRecording = false;
    this.state.value.isProcessing = false;
    this.state.value.isSpeechDetected = false;
    this.manualStop = false;
  }

  public reset(): void {
    // Complete cleanup including audio context and all resources
    this.cleanup();
    
    // Clear all audio data
    this.audioChunks = [];
    this.primaryChunks = [];
    this.secondaryChunks = [];
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
    this.primaryRecorder = null;
    this.secondaryRecorder = null;
    this.processor = null;
    this.source = null;
    this.speechStartTime = null;
    this.lastSpeechTime = 0;
    this.silenceStartTime = null;
    this.hasDetectedSpeech = false;
    
    // Reset enhanced VAD state
    this.energyHistory = [];
    this.backgroundNoiseLevel = 0;
    this.adaptiveThreshold = 0.5;
    this.conversationPauseStart = null;
    this.speechSegments = [];
    this.manualStop = false;
    
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