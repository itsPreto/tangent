/**
 * Canvas Configuration Service
 * Manages bidirectional sync between UI and YAML configuration
 */

export interface Position2D {
  x: number
  y: number
}

export interface Dimensions2D {
  width: number
  height: number
}

export interface HubConfig {
  position: Position2D
  components: {
    tangent_logo: {
      position: Position2D
      dimensions: Dimensions2D
    }
    canvas_input_container: {
      position: Position2D
      dimensions: {
        width: number
        height: number
        claude_mode_width: number
      }
      z_index: number
    }
  }
}

export interface TopicClustersConfig {
  layout_mode: 'circular' | 'grid' | 'spiral'
  circle_configuration: {
    inner_circle: {
      radius: number
      max_topics: number
    }
    outer_circle: {
      radius: number
      max_topics: number
    }
  }
}

export interface CanvasConfig {
  version: string
  hub: HubConfig
  topic_clusters: TopicClustersConfig
  viewport: {
    default_zoom: number
    min_zoom: number
    max_zoom: number
    center_animation_duration: number
  }
}

export class ConfigService {
  private baseUrl = 'http://127.0.0.1:5050/api'
  private eventSource: EventSource | null = null
  private listeners: Map<string, ((data: any) => void)[]> = new Map()

  /**
   * Get complete canvas configuration
   */
  async getConfig(): Promise<CanvasConfig> {
    const response = await fetch(`${this.baseUrl}/config`)
    if (!response.ok) {
      throw new Error(`Failed to get config: ${response.statusText}`)
    }
    const data = await response.json()
    return data.config
  }

  /**
   * Get hub configuration (logo and input container positioning)
   */
  async getHubConfig(): Promise<HubConfig> {
    const response = await fetch(`${this.baseUrl}/config/hub`)
    if (!response.ok) {
      throw new Error(`Failed to get hub config: ${response.statusText}`)
    }
    const data = await response.json()
    return data.data
  }

  /**
   * Get logo position from config
   */
  async getLogoPosition(): Promise<Position2D> {
    const hubConfig = await this.getHubConfig()
    return hubConfig.components.tangent_logo.position
  }

  /**
   * Get input container position from config
   */
  async getInputContainerPosition(): Promise<Position2D> {
    const hubConfig = await this.getHubConfig()
    return hubConfig.components.canvas_input_container.position
  }

  /**
   * Get topic clustering configuration
   */
  async getTopicConfig(): Promise<TopicClustersConfig> {
    const response = await fetch(`${this.baseUrl}/config/topic_clusters`)
    if (!response.ok) {
      throw new Error(`Failed to get topic config: ${response.statusText}`)
    }
    const data = await response.json()
    return data.data
  }

  /**
   * Get all positioning values
   */
  async getPositioningValues(): Promise<{
    hub_position: Position2D
    logo_position: Position2D
    input_container_position: Position2D
    topic_radius: number
    default_zoom: number
  }> {
    const response = await fetch(`${this.baseUrl}/config/positioning`)
    if (!response.ok) {
      throw new Error(`Failed to get positioning values: ${response.statusText}`)
    }
    const data = await response.json()
    return data.positioning
  }

  /**
   * Update hub configuration
   */
  async updateHubConfig(hubConfig: Partial<HubConfig>): Promise<void> {
    const response = await fetch(`${this.baseUrl}/config/hub`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(hubConfig)
    })

    if (!response.ok) {
      throw new Error(`Failed to update hub config: ${response.statusText}`)
    }
  }

  /**
   * Update logo position
   */
  async updateLogoPosition(position: Position2D): Promise<void> {
    const hubConfig = await this.getHubConfig()
    hubConfig.components.tangent_logo.position = position
    await this.updateHubConfig(hubConfig)
  }

  /**
   * Update input container position
   */
  async updateInputContainerPosition(position: Position2D): Promise<void> {
    const hubConfig = await this.getHubConfig()
    hubConfig.components.canvas_input_container.position = position
    await this.updateHubConfig(hubConfig)
  }

  /**
   * Start listening to real-time config changes via SSE
   */
  startListening(): void {
    if (this.eventSource) {
      this.stopListening()
    }

    this.eventSource = new EventSource(`${this.baseUrl}/config/stream`)
    
    this.eventSource.onopen = () => {
      console.log('Config stream connected')
    }

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        console.log('Config change received:', data.event, data)
        
        // Notify listeners
        const eventListeners = this.listeners.get(data.event) || []
        eventListeners.forEach(listener => listener(data))
        
        // Notify general listeners
        const allListeners = this.listeners.get('*') || []
        allListeners.forEach(listener => listener(data))
        
      } catch (error) {
        console.error('Error parsing SSE data:', error)
      }
    }

    this.eventSource.onerror = (error) => {
      console.error('Config stream error:', error)
    }
  }

  /**
   * Stop listening to config changes
   */
  stopListening(): void {
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }
  }

  /**
   * Add listener for specific config change events
   */
  addEventListener(event: string, listener: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(listener)
  }

  /**
   * Remove event listener
   */
  removeEventListener(event: string, listener: (data: any) => void): void {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      const index = eventListeners.indexOf(listener)
      if (index > -1) {
        eventListeners.splice(index, 1)
      }
    }
  }

  /**
   * Force reload config from server
   */
  async reloadConfig(): Promise<CanvasConfig> {
    const response = await fetch(`${this.baseUrl}/config/reload`, {
      method: 'POST'
    })
    if (!response.ok) {
      throw new Error(`Failed to reload config: ${response.statusText}`)
    }
    const data = await response.json()
    return data.config
  }

  /**
   * Validate configuration without saving
   */
  async validateConfig(config: any): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/config/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(config)
    })
    
    const data = await response.json()
    return data.valid
  }
}

// Singleton instance
export const configService = new ConfigService()