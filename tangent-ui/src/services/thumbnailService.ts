import { apiService } from '@/utils/api'
import html2canvas from 'html2canvas'

export interface ThumbnailData {
  id: string
  relic_id?: string
  node_id?: string
  code_index?: number
  message_index?: number
  thumbnail_url: string
  timestamp: number
  type: 'relic' | 'code_preview'
  created_at?: string
}

class ThumbnailService {
  private baseUrl: string
  
  constructor() {
    this.baseUrl = '/thumbnails'
  }
  
  /**
   * Capture screenshot from an iframe element using Screen Capture API
   */
  async captureIframeScreenshot(iframe: HTMLIFrameElement, codeContent?: string, language?: string): Promise<string> {
    try {
      // Check if iframe is fullscreen or in a modal
      const isFullscreen = document.fullscreenElement !== null || 
                          iframe.closest('.modal') !== null ||
                          iframe.closest('[class*="fullscreen"]') !== null ||
                          window.innerWidth === iframe.offsetWidth
      
      if (isFullscreen) {
        // For fullscreen, use getDisplayMedia with preferCurrentTab to capture just the tab
        const stream = await (navigator.mediaDevices as any).getDisplayMedia({
          video: {
            mediaSource: 'tab',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: false,
          preferCurrentTab: true
        })
        
        // Create video element to capture the stream
        const video = document.createElement('video')
        video.srcObject = stream
        video.play()
        
        // Wait for video to be ready
        await new Promise(resolve => {
          video.onloadedmetadata = resolve
        })
        
        // Create canvas and capture frame
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')!
        
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        
        // Draw video frame to canvas
        ctx.drawImage(video, 0, 0)
        
        // Stop the stream
        stream.getTracks().forEach(track => track.stop())
        
        // Create high-resolution thumbnail canvas
        const thumbnailCanvas = document.createElement('canvas')
        const thumbCtx = thumbnailCanvas.getContext('2d')!
        thumbnailCanvas.width = 800  // Higher resolution
        thumbnailCanvas.height = 600
        
        // Use the entire captured frame for fullscreen
        thumbCtx.drawImage(canvas, 0, 0, 800, 600)
        
        return thumbnailCanvas.toDataURL('image/jpeg', 0.95)
        
      } else {
        // For normal preview, use the original method but with higher resolution
        const stream = await (navigator.mediaDevices as any).getDisplayMedia({
          video: {
            mediaSource: 'screen',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: false,
          preferCurrentTab: true
        })
        
        // Create video element to capture the stream
        const video = document.createElement('video')
        video.srcObject = stream
        video.play()
        
        // Wait for video to be ready
        await new Promise(resolve => {
          video.onloadedmetadata = resolve
        })
        
        // Create canvas and capture frame
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')!
        
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        
        // Draw video frame to canvas
        ctx.drawImage(video, 0, 0)
        
        // Stop the stream
        stream.getTracks().forEach(track => track.stop())
        
        // Get iframe position to crop the screenshot
        const rect = iframe.getBoundingClientRect()
        const devicePixelRatio = window.devicePixelRatio || 1
        
        // Create high-resolution thumbnail canvas
        const thumbnailCanvas = document.createElement('canvas')
        const thumbCtx = thumbnailCanvas.getContext('2d')!
        thumbnailCanvas.width = 800  // Higher resolution
        thumbnailCanvas.height = 600
        
        // Calculate crop area for the iframe with better precision
        const cropX = Math.max(0, rect.left * devicePixelRatio)
        const cropY = Math.max(0, rect.top * devicePixelRatio)
        const cropWidth = Math.min(rect.width * devicePixelRatio, canvas.width - cropX)
        const cropHeight = Math.min(rect.height * devicePixelRatio, canvas.height - cropY)
        
        // Draw the cropped iframe area to thumbnail
        thumbCtx.drawImage(
          canvas, 
          cropX, cropY, cropWidth, cropHeight,  // Source crop
          0, 0, 800, 600                        // Destination size
        )
        
        return thumbnailCanvas.toDataURL('image/jpeg', 0.95)
      }
      
    } catch (error) {
      console.error('Screen capture failed:', error)
      
      // Fallback: Ask user to manually capture
      alert('Please manually capture the iframe area and click capture again when ready.')
      
      // Return a placeholder for now
      return this.createCodeThumbnail(codeContent || '')
    }
  }
  
  /**
   * Create a thumbnail based on actual code content
   */
  private createCodeThumbnail(codeContent: string): string {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    
    canvas.width = 300
    canvas.height = 200
    
    // Background
    ctx.fillStyle = '#1e1e1e'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    // Header bar
    ctx.fillStyle = '#2d2d30'
    ctx.fillRect(0, 0, canvas.width, 30)
    
    // Title
    ctx.fillStyle = '#cccccc'
    ctx.font = '12px monospace'
    ctx.fillText('Live Preview', 10, 20)
    
    // Code area background
    ctx.fillStyle = '#1e1e1e'
    ctx.fillRect(0, 30, canvas.width, canvas.height - 30)
    
    // Parse and display code with syntax highlighting
    const lines = codeContent.split('\n').slice(0, 12) // Show first 12 lines
    let y = 50
    
    lines.forEach((line, index) => {
      if (y > canvas.height - 20) return
      
      // Line number
      ctx.fillStyle = '#6e7681'
      ctx.font = '10px monospace'
      ctx.fillText((index + 1).toString().padStart(2, ' '), 10, y)
      
      // Code content with basic syntax highlighting
      const trimmedLine = line.trim()
      let color = '#d4d4d4' // Default text color
      
      if (trimmedLine.startsWith('//') || trimmedLine.startsWith('/*')) {
        color = '#6a9955' // Comments
      } else if (trimmedLine.includes('function') || trimmedLine.includes('const') || trimmedLine.includes('let')) {
        color = '#569cd6' // Keywords
      } else if (trimmedLine.includes('"') || trimmedLine.includes("'")) {
        color = '#ce9178' // Strings
      } else if (trimmedLine.includes('<') && trimmedLine.includes('>')) {
        color = '#4fc1ff' // HTML/JSX
      }
      
      ctx.fillStyle = color
      ctx.font = '10px monospace'
      const displayLine = line.length > 35 ? line.substring(0, 35) + '...' : line
      ctx.fillText(displayLine, 35, y)
      
      y += 14
    })
    
    // Add a subtle border
    ctx.strokeStyle = '#404040'
    ctx.lineWidth = 1
    ctx.strokeRect(0, 0, canvas.width, canvas.height)
    
    return canvas.toDataURL('image/jpeg', 0.9)
  }
  
  /**
   * Create a content-aware placeholder
   */
  private async createContentPlaceholder(iframe: HTMLIFrameElement): Promise<string> {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    
    canvas.width = 300
    canvas.height = 200
    
    // White background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    // Try to detect what type of content is in the iframe
    const iframeSrc = iframe.src || ''
    
    if (iframeSrc.includes('codesandbox')) {
      // It's a code preview - draw a code-like representation
      ctx.fillStyle = '#1e1e1e'
      ctx.fillRect(0, 0, canvas.width, 40) // Header bar
      
      ctx.fillStyle = '#ffffff'
      ctx.font = '12px monospace'
      ctx.fillText('Preview', 10, 25)
      
      // Draw some code-like lines
      ctx.fillStyle = '#f0f0f0'
      ctx.fillRect(0, 40, canvas.width, canvas.height - 40)
      
      // Code lines
      const colors = ['#569cd6', '#4ec9b0', '#dcdcaa', '#ce9178', '#d4d4d4']
      let y = 60
      
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = colors[i % colors.length]
        const width = 40 + Math.random() * 100
        ctx.fillRect(20, y, width, 2)
        y += 15
      }
    } else {
      // Generic preview
      ctx.fillStyle = '#f0f0f0'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      ctx.fillStyle = '#666666'
      ctx.font = '14px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('Live Preview', canvas.width / 2, canvas.height / 2)
    }
    
    // Add border
    ctx.strokeStyle = '#e0e0e0'
    ctx.lineWidth = 1
    ctx.strokeRect(0, 0, canvas.width, canvas.height)
    
    return canvas.toDataURL('image/jpeg', 0.9)
  }
  
  
  private async fallbackCapture(iframe: HTMLIFrameElement): Promise<string> {
    // Create a canvas element
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    
    // Set canvas dimensions to match iframe
    const rect = iframe.getBoundingClientRect()
    canvas.width = rect.width
    canvas.height = rect.height
    
    // Create a simple placeholder thumbnail
    ctx.fillStyle = '#f0f0f0'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    // Add some styling
    ctx.fillStyle = '#666'
    ctx.font = '16px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('Preview', canvas.width / 2, canvas.height / 2 - 10)
    ctx.fillText('Thumbnail', canvas.width / 2, canvas.height / 2 + 10)
    
    // Add a border
    ctx.strokeStyle = '#ddd'
    ctx.lineWidth = 2
    ctx.strokeRect(0, 0, canvas.width, canvas.height)
    
    return canvas.toDataURL('image/jpeg', 0.8)
  }
  
  /**
   * Save thumbnail data to backend
   */
  async saveThumbnail(thumbnailData: Omit<ThumbnailData, 'id' | 'timestamp'>): Promise<ThumbnailData> {
    const response = await apiService.fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...thumbnailData,
        timestamp: Date.now()
      })
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to save thumbnail')
    }
    
    return response.json()
  }
  
  /**
   * Get thumbnail for a relic or code preview
   */
  async getThumbnail(relicId?: string, nodeId?: string, codeIndex?: number): Promise<ThumbnailData | null> {
    const params = new URLSearchParams()
    if (relicId) params.set('relicId', relicId)
    if (nodeId) params.set('nodeId', nodeId)
    if (codeIndex !== undefined) params.set('codeIndex', codeIndex.toString())
    
    const url = `${apiService.getApiUrl()}${this.baseUrl}?${params.toString()}`
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      if (response.status === 404) {
        return null // Return null for 404s to allow fallback logic
      }
      
      if (!response.ok) {
        throw new Error(`Failed to get thumbnail: ${response.status} ${response.statusText}`)
      }
      
      return response.json()
    } catch (error) {
      // If it's a network error or parsing error, re-throw
      throw error
    }
  }
  
  /**
   * Delete a thumbnail
   */
  async deleteThumbnail(thumbnailId: string): Promise<void> {
    const response = await apiService.fetch(`${this.baseUrl}/${thumbnailId}`, {
      method: 'DELETE'
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to delete thumbnail')
    }
  }
  
  /**
   * Convert data URL to blob for upload
   */
  dataURLToBlob(dataURL: string): Blob {
    const arr = dataURL.split(',')
    const mime = arr[0].match(/:(.*?);/)![1]
    const bstr = atob(arr[1])
    let n = bstr.length
    const u8arr = new Uint8Array(n)
    
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n)
    }
    
    return new Blob([u8arr], { type: mime })
  }
  
  /**
   * Upload thumbnail image to backend and get URL
   */
  async uploadThumbnailImage(dataURL: string, filename: string): Promise<string> {
    console.log('Uploading thumbnail:', { dataURL: dataURL.substring(0, 100), filename })
    
    const blob = this.dataURLToBlob(dataURL)
    console.log('Created blob:', { size: blob.size, type: blob.type })
    
    const formData = new FormData()
    formData.append('thumbnail', blob, filename)
    
    const response = await apiService.fetch('/upload/thumbnail', {
      method: 'POST',
      body: formData
    })
    
    if (!response.ok) {
      const error = await response.json()
      console.error('Upload error details:', error)
      throw new Error(error.error || 'Failed to upload thumbnail')
    }
    
    const result = await response.json()
    return result.url
  }
}

export const thumbnailService = new ThumbnailService()