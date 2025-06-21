import { ref, computed } from 'vue';

export interface TTSSettings {
  voice: string;
  speed: number;
  autoRead: boolean;
}

export interface TTSState {
  isPlaying: boolean;
  isSpeaking: boolean;
  currentText: string;
  error: string | null;
  queue: string[];
}

class StreamingTTSService {
  private audioContext: AudioContext | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private audioQueue: HTMLAudioElement[] = [];
  
  // Reactive state
  public state = ref<TTSState>({
    isPlaying: false,
    isSpeaking: false,
    currentText: '',
    error: null,
    queue: []
  });

  public settings = ref<TTSSettings>({
    voice: 'af_heart',
    speed: 1.0,
    autoRead: false
  });

  // Computed properties
  public isPlaying = computed(() => this.state.value.isPlaying);
  public isSpeaking = computed(() => this.state.value.isSpeaking);
  public error = computed(() => this.state.value.error);
  public canSpeak = computed(() => 'speechSynthesis' in window || true); // Always true for our custom TTS

  constructor() {
    this.initializeAudioContext();
  }

  private async initializeAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
      this.state.value.error = 'Audio not supported';
    }
  }

  public async speak(text: string, options?: Partial<TTSSettings>): Promise<void> {
    if (!text.trim()) return;

    const voice = options?.voice || this.settings.value.voice;
    const speed = options?.speed || this.settings.value.speed;

    try {
      this.state.value.error = null;
      this.state.value.currentText = text;
      this.state.value.isSpeaking = true;

      // Call backend TTS service
      const response = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text,
          voice,
          speed
        })
      });

      if (!response.ok) {
        throw new Error(`TTS API error: ${response.status}`);
      }

      const result = await response.json();
      
      // Play the audio
      await this.playAudioFromBase64(result.audio);

    } catch (error) {
      console.error('TTS error:', error);
      this.state.value.error = `TTS failed: ${error}`;
    } finally {
      this.state.value.isSpeaking = false;
      this.state.value.currentText = '';
    }
  }

  public async speakStreaming(textStream: string, isComplete: boolean = false): Promise<void> {
    // Extract speakable chunks from the stream
    const chunks = this.extractSpeakableChunks(textStream);
    
    for (const chunk of chunks) {
      if (chunk.trim()) {
        this.state.value.queue.push(chunk);
        // Process queue if not already processing
        if (!this.state.value.isSpeaking) {
          this.processQueue();
        }
      }
    }

    // If stream is complete, make sure we process any remaining text
    if (isComplete && textStream.trim()) {
      const remaining = this.extractRemaining(textStream);
      if (remaining.trim()) {
        this.state.value.queue.push(remaining);
        if (!this.state.value.isSpeaking) {
          this.processQueue();
        }
      }
    }
  }

  private extractSpeakableChunks(text: string): string[] {
    // Extract complete sentences or meaningful chunks
    const chunks: string[] = [];
    
    // Split by sentence endings
    const sentences = text.match(/[^.!?]*[.!?]+/g);
    if (sentences) {
      chunks.push(...sentences.map(s => s.trim()).filter(s => s.length > 0));
    }

    // If no complete sentences, look for other natural breaks
    if (chunks.length === 0) {
      const phrases = text.match(/[^,;:]*[,;:]+/g);
      if (phrases && phrases.length > 0) {
        chunks.push(...phrases.map(s => s.trim()).filter(s => s.length > 10));
      }
    }

    return chunks;
  }

  private extractRemaining(text: string): string {
    // Get any remaining text that doesn't end with punctuation
    const lastComplete = Math.max(
      text.lastIndexOf('.'),
      text.lastIndexOf('!'),
      text.lastIndexOf('?'),
      text.lastIndexOf(','),
      text.lastIndexOf(';'),
      text.lastIndexOf(':')
    );

    if (lastComplete > 0 && lastComplete < text.length - 1) {
      return text.substring(lastComplete + 1).trim();
    }

    return '';
  }

  private async processQueue(): Promise<void> {
    if (this.state.value.queue.length === 0 || this.state.value.isSpeaking) {
      return;
    }

    const chunk = this.state.value.queue.shift();
    if (chunk) {
      await this.speak(chunk);
      // Continue processing queue
      setTimeout(() => this.processQueue(), 100);
    }
  }

  private async playAudioFromBase64(audioBase64: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Create audio element
        const audio = new Audio();
        const audioBlob = this.base64ToBlob(audioBase64, 'audio/wav');
        const audioUrl = URL.createObjectURL(audioBlob);

        audio.src = audioUrl;
        audio.volume = 1.0;

        // Set up event listeners
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          this.state.value.isPlaying = false;
          resolve();
        };

        audio.onerror = (error) => {
          URL.revokeObjectURL(audioUrl);
          this.state.value.isPlaying = false;
          reject(new Error('Audio playback failed'));
        };

        audio.onloadeddata = () => {
          this.state.value.isPlaying = true;
          audio.play().catch(reject);
        };

        // Load the audio
        audio.load();

      } catch (error) {
        reject(error);
      }
    });
  }

  private base64ToBlob(base64: string, mimeType: string): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }

  public stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
    }
    
    // Clear queue
    this.state.value.queue = [];
    this.state.value.isPlaying = false;
    this.state.value.isSpeaking = false;
    this.state.value.currentText = '';
  }

  public updateSettings(newSettings: Partial<TTSSettings>): void {
    this.settings.value = {
      ...this.settings.value,
      ...newSettings
    };
  }

  public clearError(): void {
    this.state.value.error = null;
  }

  public async getAvailableVoices(): Promise<Record<string, string>> {
    try {
      const response = await fetch('/api/tts-voices');
      if (!response.ok) {
        throw new Error('Failed to fetch voices');
      }
      const result = await response.json();
      return result.voices || {};
    } catch (error) {
      console.error('Error fetching voices:', error);
      return {
        'af_heart': 'American Female (Heart)',
        'af_sarah': 'American Female (Sarah)',
        'am_adam': 'American Male (Adam)',
        'bm_george': 'British Male (George)'
      };
    }
  }
}

// Export singleton instance
export const streamingTTSService = new StreamingTTSService();
export default streamingTTSService;