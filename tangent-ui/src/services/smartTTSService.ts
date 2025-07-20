import { ref, computed, reactive } from 'vue'
import { apiService } from '../utils/api'

export interface TTSVoice {
  id: string
  name: string
}

export interface TTSSettings {
  voice: string
  speed: number
  autoRead: boolean
  enabled: boolean
}

export interface TTSChunk {
  text: string
  audioData: ArrayBuffer | null
  startTime: number
  endTime?: number
  synthesisTime?: number
  isReady: boolean
}

export interface TTSQueue {
  chunks: TTSChunk[]
  currentIndex: number
  isPlaying: boolean
  isSynthesizing: boolean
  totalChunks: number
}

class SmartTTSService {
  private get apiUrl() { return apiService.getApiUrl() }
  
  // Reactive state
  public isPlaying = ref(false)
  public isSpeaking = ref(false)
  public currentText = ref('')
  public error = ref<string | null>(null)
  public voices = ref<TTSVoice[]>([])
  public progress = ref(0) // 0-100 percentage
  
  // Settings
  public settings = reactive<TTSSettings>({
    voice: 'af_heart',
    speed: 1.0,
    autoRead: false,
    enabled: true
  })
  
  // Audio context for playback
  private audioContext: AudioContext | null = null
  private currentAudioSource: AudioBufferSourceNode | null = null
  private abortController: AbortController | null = null
  
  // Smart queue management
  private queue: TTSQueue = {
    chunks: [],
    currentIndex: 0,
    isPlaying: false,
    isSynthesizing: false,
    totalChunks: 0
  }
  
  // Adaptive chunking parameters
  private chunkSize = 1 // Start with 1 sentence
  private maxChunkSize = 3 // Max 3 sentences per chunk
  private minChunkSize = 1 // Min 1 sentence per chunk
  private averageSynthesisTime = 0
  private synthesisHistory: number[] = []
  private isWarmedUp = false
  
  constructor() {
    this.loadSettings()
    this.loadVoices()
    // Don't initialize audio context until user interaction
    this.warmupTTS()
  }
  
  private async initializeAudioContext() {
    if (this.audioContext) return // Already initialized
    
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      // Resume context if it's suspended (required by browser autoplay policy)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }
    } catch (error) {
      console.error('Failed to initialize audio context:', error)
      this.error.value = 'Audio playback not supported'
    }
  }
  
  private async warmupTTS(): Promise<void> {
    // Wait for voices to load first
    setTimeout(async () => {
      if (!this.isWarmedUp && this.voices.value.length > 0) {
        try {
          console.log('SmartTTS: Warming up TTS engine...')
          const warmupText = "Hi." // Very short text for warmup
          const warmupSettings = {
            voice: this.settings.voice,
            speed: this.settings.speed
          }
          
          const startTime = Date.now()
          const response = await fetch(`${this.apiUrl}/text-to-speech`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              text: warmupText,
              voice: warmupSettings.voice,
              speed: warmupSettings.speed,
              lang_code: 'a'
            })
          })
          
          if (response.ok) {
            const warmupTime = Date.now() - startTime
            this.isWarmedUp = true
            console.log(`SmartTTS: Warmup completed in ${warmupTime}ms`)
          } else {
            console.log('SmartTTS: Warmup failed, but continuing...')
          }
        } catch (error) {
          console.log('SmartTTS: Warmup failed:', error)
          // Continue anyway, warmup is optional
        }
      }
    }, 1000) // Wait 1 second for voices to load
  }
  
  async loadVoices(): Promise<void> {
    try {
      const response = await fetch(`${this.apiUrl}/tts-voices`)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      this.voices.value = Object.entries(data.voices).map(([id, name]) => ({
        id,
        name: name as string
      }))
      
      // Set default voice if current voice is not available
      if (!this.voices.value.find(v => v.id === this.settings.voice)) {
        this.settings.voice = this.voices.value[0]?.id || 'af_heart'
      }
      
    } catch (error) {
      console.error('Failed to load TTS voices:', error)
      this.error.value = 'Failed to load available voices'
    }
  }
  
  async speakSmart(text: string, options: Partial<TTSSettings> = {}): Promise<void> {
    if (!this.settings.enabled || !text.trim()) {
      return
    }
    
    try {
      // Initialize audio context on first user interaction
      await this.initializeAudioContext()
      
      this.error.value = null
      this.currentText.value = text
      this.isSpeaking.value = true
      this.progress.value = 0
      
      // Create abort controller for this session
      this.abortController = new AbortController()
      
      const effectiveSettings = { ...this.settings, ...options }
      
      // Clean and chunk text
      const cleanText = this.cleanTextForSpeech(text)
      const chunks = this.createSmartChunks(cleanText)
      
      // Initialize queue
      this.queue = {
        chunks: chunks.map(text => ({
          text,
          audioData: null,
          startTime: 0,
          isReady: false
        })),
        currentIndex: 0,
        isPlaying: false,
        isSynthesizing: false,
        totalChunks: chunks.length
      }
      
      console.log(`SmartTTS: Created ${chunks.length} chunks, starting with ${this.chunkSize} sentences per chunk`)
      
      // Start synthesis and playback pipeline
      await this.startSmartPipeline(effectiveSettings)
      
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('SmartTTS: Operation aborted')
        return
      }
      console.error('SmartTTS error:', error)
      this.error.value = error instanceof Error ? error.message : 'TTS generation failed'
    } finally {
      this.isSpeaking.value = false
      this.currentText.value = ''
      this.progress.value = 0
      this.abortController = null
    }
  }
  
  private createSmartChunks(text: string): string[] {
    // Split by sentences first
    const sentences = text.match(/[^.!?]*[.!?]+/g) || []
    const cleanSentences = sentences.map(s => s.trim()).filter(s => s.length > 0)
    
    if (cleanSentences.length === 0) {
      // Fallback for text without proper sentence endings
      const words = text.split(/\s+/).filter(word => word.length > 0)
      const chunks: string[] = []
      const wordsPerChunk = Math.max(8, Math.floor(words.length / 4)) // Reasonable chunks
      
      for (let i = 0; i < words.length; i += wordsPerChunk) {
        chunks.push(words.slice(i, i + wordsPerChunk).join(' '))
      }
      
      return chunks
    }
    
    // Group sentences into chunks
    const chunks: string[] = []
    let currentChunk: string[] = []
    
    for (let i = 0; i < cleanSentences.length; i++) {
      currentChunk.push(cleanSentences[i])
      
      // Check if we should end this chunk
      const shouldEndChunk = 
        currentChunk.length >= this.chunkSize || // Reached target sentence count
        i === cleanSentences.length - 1 || // Last sentence
        this.isNaturalBreak(cleanSentences[i]) // Natural paragraph break
      
      if (shouldEndChunk) {
        chunks.push(currentChunk.join(' '))
        currentChunk = []
      }
    }
    
    // Add any remaining sentences
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '))
    }
    
    return chunks
  }
  
  private isNaturalBreak(sentence: string): boolean {
    // Look for natural paragraph breaks or long sentences
    return sentence.length > 200 || sentence.includes('\n')
  }
  
  private async startSmartPipeline(settings: TTSSettings): Promise<void> {
    // Start synthesis of first chunk immediately
    this.queue.isSynthesizing = true
    await this.synthesizeChunk(0, settings)
    
    // Start playback of first chunk as soon as it's ready
    this.startPlaybackLoop()
    
    // Continue synthesis of remaining chunks
    this.continueSynthesis(settings)
  }
  
  private async synthesizeChunk(index: number, settings: TTSSettings): Promise<void> {
    if (index >= this.queue.chunks.length) return
    
    const chunk = this.queue.chunks[index]
    if (chunk.isReady) return
    
    const startTime = Date.now()
    
    try {
      const response = await fetch(`${this.apiUrl}/text-to-speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: chunk.text,
          voice: settings.voice,
          speed: settings.speed,
          lang_code: 'a'
        }),
        signal: this.abortController?.signal
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      const audioData = this.base64ToArrayBuffer(data.audio)
      
      // Update chunk with audio data
      chunk.audioData = audioData
      chunk.isReady = true
      chunk.synthesisTime = Date.now() - startTime
      
      // Track synthesis performance for adaptive chunking
      this.updateSynthesisPerformance(chunk.synthesisTime)
      
      console.log(`SmartTTS: Synthesized chunk ${index + 1}/${this.queue.totalChunks} in ${chunk.synthesisTime}ms`)
      
    } catch (error) {
      if (error.name === 'AbortError') {
        return
      }
      console.error(`SmartTTS: Error synthesizing chunk ${index}:`, error)
      // Mark chunk as failed but continue with others
      chunk.isReady = false
      chunk.audioData = null
    }
  }
  
  private async continueSynthesis(settings: TTSSettings): Promise<void> {
    // Synthesize remaining chunks sequentially
    for (let i = 1; i < this.queue.chunks.length; i++) {
      if (this.abortController?.signal.aborted) {
        return
      }
      
      // Synthesize next chunk
      await this.synthesizeChunk(i, settings)
      
      // Adapt chunk size based on performance
      if (i === 1) { // After first chunk, adapt
        this.adaptChunkSize()
      }
    }
    
    this.queue.isSynthesizing = false
    console.log('SmartTTS: Synthesis pipeline completed')
  }
  
  private updateSynthesisPerformance(time: number): void {
    this.synthesisHistory.push(time)
    if (this.synthesisHistory.length > 10) {
      this.synthesisHistory.shift() // Keep only last 10 measurements
    }
    
    this.averageSynthesisTime = this.synthesisHistory.reduce((a, b) => a + b, 0) / this.synthesisHistory.length
  }
  
  private adaptChunkSize(): void {
    // If synthesis is fast (< 800ms), increase chunk size
    if (this.averageSynthesisTime < 800 && this.chunkSize < this.maxChunkSize) {
      this.chunkSize = Math.min(this.chunkSize + 1, this.maxChunkSize)
      console.log(`SmartTTS: Increased chunk size to ${this.chunkSize} sentences`)
    }
    // If synthesis is slow (> 2000ms), decrease chunk size
    else if (this.averageSynthesisTime > 2000 && this.chunkSize > this.minChunkSize) {
      this.chunkSize = Math.max(this.chunkSize - 1, this.minChunkSize)
      console.log(`SmartTTS: Decreased chunk size to ${this.chunkSize} sentences`)
    }
  }
  
  private async startPlaybackLoop(): Promise<void> {
    this.queue.isPlaying = true
    this.isPlaying.value = true
    
    while (this.queue.currentIndex < this.queue.chunks.length) {
      if (this.abortController?.signal.aborted) {
        break
      }
      
      const chunk = this.queue.chunks[this.queue.currentIndex]
      
      // Wait for chunk to be ready
      await this.waitForChunk(chunk)
      
      if (chunk.isReady && chunk.audioData) {
        // Play the chunk
        await this.playChunk(chunk)
        
        // Update progress
        this.progress.value = Math.round(((this.queue.currentIndex + 1) / this.queue.totalChunks) * 100)
        
        // Start synthesizing ahead chunks if needed
        const nextChunkIndex = this.queue.currentIndex + 2 // Look ahead 2 chunks
        if (nextChunkIndex < this.queue.chunks.length) {
          const nextChunk = this.queue.chunks[nextChunkIndex]
          if (!nextChunk.isReady && !nextChunk.audioData) {
            // Synthesis will be handled by continueSynthesis
          }
        }
      }
      
      this.queue.currentIndex++
    }
    
    this.queue.isPlaying = false
    this.isPlaying.value = false
    this.progress.value = 100
    
    console.log('SmartTTS: Playback completed')
  }
  
  private async waitForChunk(chunk: TTSChunk): Promise<void> {
    const maxWait = 5000 // 5 seconds max wait
    const startTime = Date.now()
    
    while (!chunk.isReady && chunk.audioData === null && Date.now() - startTime < maxWait) {
      if (this.abortController?.signal.aborted) {
        throw new Error('Aborted')
      }
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    
    if (!chunk.isReady && chunk.audioData === null) {
      throw new Error('Chunk synthesis timeout')
    }
  }
  
  private async playChunk(chunk: TTSChunk): Promise<void> {
    if (!chunk.audioData || !this.audioContext) {
      return
    }
    
    try {
      // Resume context if suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }
      
      const audioBuffer = await this.audioContext.decodeAudioData(chunk.audioData.slice(0))
      
      return new Promise((resolve, reject) => {
        const source = this.audioContext!.createBufferSource()
        source.buffer = audioBuffer
        source.connect(this.audioContext!.destination)
        
        this.currentAudioSource = source
        chunk.startTime = Date.now()
        
        source.onended = () => {
          chunk.endTime = Date.now()
          this.currentAudioSource = null
          resolve()
        }
        
        source.onerror = (error) => {
          this.currentAudioSource = null
          reject(error)
        }
        
        source.start()
      })
      
    } catch (error) {
      console.error('SmartTTS: Audio playback error:', error)
      throw error
    }
  }
  
  stop(): void {
    // Abort any ongoing synthesis
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
    
    // Stop current audio
    if (this.currentAudioSource) {
      this.currentAudioSource.stop()
      this.currentAudioSource = null
    }
    
    // Reset queue
    this.queue = {
      chunks: [],
      currentIndex: 0,
      isPlaying: false,
      isSynthesizing: false,
      totalChunks: 0
    }
    
    // Reset reactive state
    this.isPlaying.value = false
    this.isSpeaking.value = false
    this.currentText.value = ''
    this.progress.value = 0
    this.error.value = null
    
    console.log('SmartTTS: Stopped and reset')
  }
  
  private cleanTextForSpeech(text: string): string {
    // Remove markdown formatting
    text = text.replace(/\*\*(.*?)\*\*/g, '$1') // Bold
    text = text.replace(/\*(.*?)\*/g, '$1')     // Italic
    text = text.replace(/`(.*?)`/g, '$1')       // Inline code
    text = text.replace(/\[(.*?)\]\(.*?\)/g, '$1') // Links
    
    // Handle code blocks
    text = text.replace(/```[\s\S]*?```/g, ' [code block] ')
    text = text.replace(/`[^`]+`/g, ' [code] ')
    
    // Clean up whitespace
    text = text.replace(/\s+/g, ' ').trim()
    
    return text
  }
  
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = window.atob(base64)
    const len = binaryString.length
    const bytes = new Uint8Array(len)
    
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    
    return bytes.buffer
  }
  
  updateSettings(newSettings: Partial<TTSSettings>): void {
    Object.assign(this.settings, newSettings)
    this.saveSettings()
  }
  
  private loadSettings(): void {
    try {
      const saved = localStorage.getItem('tangent-smart-tts-settings')
      if (saved) {
        const parsed = JSON.parse(saved)
        Object.assign(this.settings, parsed)
      }
    } catch (error) {
      console.error('Failed to load TTS settings:', error)
    }
  }
  
  private saveSettings(): void {
    try {
      localStorage.setItem('tangent-smart-tts-settings', JSON.stringify(this.settings))
    } catch (error) {
      console.error('Failed to save TTS settings:', error)
    }
  }
  
  // Computed properties
  get canSpeak(): boolean {
    return this.settings.enabled && this.voices.value.length > 0
  }
  
  get selectedVoice(): TTSVoice | undefined {
    return this.voices.value.find(v => v.id === this.settings.voice)
  }
  
  get isActive(): boolean {
    return this.isSpeaking.value || this.isPlaying.value
  }
  
  get queueStatus(): { current: number; total: number; progress: number } {
    return {
      current: this.queue.currentIndex + 1,
      total: this.queue.totalChunks,
      progress: this.progress.value
    }
  }
}

// Export singleton instance
export const smartTTSService = new SmartTTSService()
export default smartTTSService