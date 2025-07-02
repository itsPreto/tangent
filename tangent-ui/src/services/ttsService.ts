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

class TTSService {
  private get apiUrl() { return apiService.getApiUrl() }
  
  // Reactive state
  public isPlaying = ref(false)
  public isSpeaking = ref(false)
  public currentText = ref('')
  public error = ref<string | null>(null)
  public voices = ref<TTSVoice[]>([])
  
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
  private audioQueue: ArrayBuffer[] = []
  private isProcessingQueue = false
  private abortController: AbortController | null = null
  
  constructor() {
    this.loadSettings()
    this.loadVoices()
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
  
  async speak(text: string, options: Partial<TTSSettings> = {}): Promise<void> {
    if (!this.settings.enabled || !text.trim()) {
      return
    }
    
    try {
      this.error.value = null
      this.currentText.value = text
      this.isSpeaking.value = true
      
      const effectiveSettings = { ...this.settings, ...options }
      
      // Clean text for better speech
      const cleanText = this.cleanTextForSpeech(text)
      
      const response = await fetch(`${this.apiUrl}/text-to-speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: cleanText,
          voice: effectiveSettings.voice,
          speed: effectiveSettings.speed,
          lang_code: 'a' // American English
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      
      // Decode base64 audio
      const audioData = this.base64ToArrayBuffer(data.audio)
      
      // Play audio
      await this.playAudio(audioData)
      
    } catch (error) {
      console.error('TTS error:', error)
      this.error.value = error instanceof Error ? error.message : 'TTS generation failed'
    } finally {
      this.isSpeaking.value = false
      this.currentText.value = ''
    }
  }
  
  async speakSemanticChunks(text: string, options: Partial<TTSSettings> = {}): Promise<void> {
    if (!this.settings.enabled || !text.trim()) {
      return
    }
    
    try {
      this.error.value = null
      this.currentText.value = text
      this.isSpeaking.value = true
      
      // Create abort controller for this session
      this.abortController = new AbortController()
      
      const effectiveSettings = { ...this.settings, ...options }
      const chunks = this.splitIntoSemanticChunks(text)
      
      console.log('TTS: Split text into', chunks.length, 'semantic chunks')
      
      // Process chunks sequentially
      for (let i = 0; i < chunks.length; i++) {
        // Check if we should abort
        if (this.abortController.signal.aborted) {
          console.log('TTS: Aborted during chunk processing')
          return
        }
        
        const chunk = chunks[i]
        if (!chunk.trim()) continue
        
        console.log(`TTS: Processing chunk ${i + 1}/${chunks.length}:`, chunk.slice(0, 50))
        
        try {
          await this.speakChunk(chunk, effectiveSettings)
          
          // Add a small pause between chunks for natural flow
          if (i < chunks.length - 1) {
            await this.delay(150) // 150ms pause between chunks
          }
        } catch (chunkError) {
          if (chunkError.name === 'AbortError') {
            console.log('TTS: Chunk processing aborted')
            return
          }
          console.error(`TTS: Error in chunk ${i + 1}:`, chunkError)
          // Continue with next chunk instead of failing entirely
        }
      }
      
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('TTS: Semantic chunks processing aborted')
        return
      }
      console.error('TTS semantic chunks error:', error)
      this.error.value = error instanceof Error ? error.message : 'TTS generation failed'
    } finally {
      this.isSpeaking.value = false
      this.currentText.value = ''
      this.abortController = null
    }
  }

  private splitIntoSemanticChunks(text: string): string[] {
    // Clean the text first
    const cleanText = this.cleanTextForSpeech(text)
    
    // Split by sentences first (periods, exclamation marks, question marks)
    const sentenceEnders = /[.!?]+(?:\s+|$)/g
    const sentences: string[] = []
    let lastIndex = 0
    let match
    
    while ((match = sentenceEnders.exec(cleanText)) !== null) {
      const sentence = cleanText.slice(lastIndex, match.index + match[0].length).trim()
      if (sentence) {
        sentences.push(sentence)
      }
      lastIndex = match.index + match[0].length
    }
    
    // Add any remaining text
    const remaining = cleanText.slice(lastIndex).trim()
    if (remaining) {
      sentences.push(remaining)
    }
    
    // Now group sentences into chunks that aren't too long or too short
    const chunks: string[] = []
    let currentChunk = ''
    
    for (const sentence of sentences) {
      // If adding this sentence would make the chunk too long, start a new chunk
      if (currentChunk && (currentChunk.length + sentence.length) > 200) {
        chunks.push(currentChunk.trim())
        currentChunk = sentence
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence
      }
      
      // If current chunk is a good size (50-200 chars), we can end it here
      if (currentChunk.length >= 50 && currentChunk.length <= 200) {
        chunks.push(currentChunk.trim())
        currentChunk = ''
      }
    }
    
    // Add any remaining chunk
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim())
    }
    
    // Handle very long chunks by splitting on commas, semicolons, colons
    const finalChunks: string[] = []
    for (const chunk of chunks) {
      if (chunk.length <= 300) {
        finalChunks.push(chunk)
      } else {
        // Split long chunks on punctuation
        const subChunks = this.splitLongChunk(chunk)
        finalChunks.push(...subChunks)
      }
    }
    
    return finalChunks.filter(chunk => chunk.trim().length > 0)
  }
  
  private splitLongChunk(text: string): string[] {
    const chunks: string[] = []
    const punctuationSplits = /[,;:]+\s+/g
    let lastIndex = 0
    let match
    
    while ((match = punctuationSplits.exec(text)) !== null) {
      const chunk = text.slice(lastIndex, match.index + match[0].length).trim()
      if (chunk && chunk.length >= 30) {
        chunks.push(chunk)
        lastIndex = match.index + match[0].length
      }
    }
    
    // Add remaining text
    const remaining = text.slice(lastIndex).trim()
    if (remaining) {
      if (chunks.length > 0 && chunks[chunks.length - 1].length + remaining.length <= 300) {
        // Merge with last chunk if it's not too long
        chunks[chunks.length - 1] += ' ' + remaining
      } else {
        chunks.push(remaining)
      }
    }
    
    return chunks.length > 0 ? chunks : [text]
  }
  
  private async speakChunk(text: string, settings: TTSSettings): Promise<void> {
    const response = await fetch(`${this.apiUrl}/text-to-speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: text,
        voice: settings.voice,
        speed: settings.speed,
        lang_code: 'a'
      }),
      signal: this.abortController?.signal
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    const audioData = this.base64ToArrayBuffer(data.audio)
    
    await this.playAudio(audioData)
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  async speakLong(text: string, options: Partial<TTSSettings> = {}): Promise<void> {
    if (!this.settings.enabled || !text.trim()) {
      return
    }
    
    try {
      this.error.value = null
      this.currentText.value = text
      this.isSpeaking.value = true
      
      const effectiveSettings = { ...this.settings, ...options }
      const cleanText = this.cleanTextForSpeech(text)
      
      // Use streaming endpoint for long texts
      const response = await fetch(`${this.apiUrl}/tts-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: cleanText,
          voice: effectiveSettings.voice,
          speed: effectiveSettings.speed,
          lang_code: 'a'
        })
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body reader available')
      }
      
      let buffer = ''
      
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break
        
        buffer += new TextDecoder().decode(value)
        
        // Process complete lines
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6)
            if (jsonStr.trim()) {
              try {
                const data = JSON.parse(jsonStr)
                
                if (data.error) {
                  console.error('TTS chunk error:', data.error)
                  continue
                }
                
                if (data.done) {
                  return
                }
                
                if (data.audio) {
                  const audioData = this.base64ToArrayBuffer(data.audio)
                  this.audioQueue.push(audioData)
                  
                  if (!this.isProcessingQueue) {
                    this.processAudioQueue()
                  }
                }
              } catch (e) {
                console.error('Failed to parse TTS chunk:', e)
              }
            }
          }
        }
      }
      
    } catch (error) {
      console.error('TTS streaming error:', error)
      this.error.value = error instanceof Error ? error.message : 'TTS streaming failed'
    } finally {
      this.isSpeaking.value = false
      this.currentText.value = ''
    }
  }
  
  private async processAudioQueue(): Promise<void> {
    if (this.isProcessingQueue || this.audioQueue.length === 0) {
      return
    }
    
    this.isProcessingQueue = true
    
    while (this.audioQueue.length > 0) {
      const audioData = this.audioQueue.shift()!
      await this.playAudio(audioData)
      
      // Small delay between chunks
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    this.isProcessingQueue = false
  }
  
  private async playAudio(audioData: ArrayBuffer): Promise<void> {
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
      }
      
      // Resume context if suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }
      
      const audioBuffer = await this.audioContext.decodeAudioData(audioData.slice(0))
      
      return new Promise((resolve, reject) => {
        const source = this.audioContext!.createBufferSource()
        source.buffer = audioBuffer
        source.connect(this.audioContext!.destination)
        
        this.currentAudioSource = source
        this.isPlaying.value = true
        
        source.onended = () => {
          this.isPlaying.value = false
          this.currentAudioSource = null
          resolve()
        }
        
        source.onerror = (error) => {
          this.isPlaying.value = false
          this.currentAudioSource = null
          reject(error)
        }
        
        source.start()
      })
      
    } catch (error) {
      console.error('Audio playback error:', error)
      throw error
    }
  }
  
  stop(): void {
    // Abort any ongoing generation
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
    
    if (this.currentAudioSource) {
      this.currentAudioSource.stop()
      this.currentAudioSource = null
    }
    
    // Clear queue
    this.audioQueue = []
    this.isProcessingQueue = false
    
    this.isPlaying.value = false
    this.isSpeaking.value = false
    this.currentText.value = ''
    this.error.value = null
  }

  reset(): void {
    // Complete cleanup and reset
    this.stop()
    
    // Close and reset audio context
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
    
    // Clear all state
    this.audioQueue = []
    this.isProcessingQueue = false
    this.currentAudioSource = null
    this.abortController = null
    
    // Reset reactive state
    this.isPlaying.value = false
    this.isSpeaking.value = false
    this.currentText.value = ''
    this.error.value = null
    this.voices.value = []
    
    console.log('TTSService: Complete reset performed')
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
    
    // Limit length for single requests (use streaming for longer texts)
    if (text.length > 1000) {
      return text.substring(0, 1000) + '...'
    }
    
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
      const saved = localStorage.getItem('tangent-tts-settings')
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
      localStorage.setItem('tangent-tts-settings', JSON.stringify(this.settings))
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
}

// Export singleton instance
export const ttsService = new TTSService()
export default ttsService

// Extend window type for webkit audio context
declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext
  }
}