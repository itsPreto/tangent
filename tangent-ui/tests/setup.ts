import { afterEach, vi } from 'vitest'

afterEach(() => {
  vi.clearAllMocks()
})

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
global.localStorage = localStorageMock

// Mock canvas and WebGL context
HTMLCanvasElement.prototype.getContext = vi.fn((contextType) => {
  if (contextType === '2d') {
    return {
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Array(4) })),
      putImageData: vi.fn(),
      createImageData: vi.fn(() => ({ data: new Array(4) })),
      setTransform: vi.fn(),
      drawImage: vi.fn(),
      save: vi.fn(),
      fillText: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      stroke: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      rotate: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      measureText: vi.fn(() => ({ width: 100 })),
      transform: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
    }
  }
  
  // WebGL context mock
  return {
    canvas: {},
    drawingBufferWidth: 1024,
    drawingBufferHeight: 768,
    getParameter: vi.fn(),
    getExtension: vi.fn(),
    getContextAttributes: vi.fn(() => ({ antialias: true })),
    createShader: vi.fn(),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => true),
    createProgram: vi.fn(),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => true),
    useProgram: vi.fn(),
    createBuffer: vi.fn(),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    vertexAttribPointer: vi.fn(),
    enableVertexAttribArray: vi.fn(),
    getAttribLocation: vi.fn(() => 0),
    getUniformLocation: vi.fn(() => {}),
    uniform1f: vi.fn(),
    uniform2f: vi.fn(),
    uniform3f: vi.fn(),
    uniform4f: vi.fn(),
    uniformMatrix4fv: vi.fn(),
    clear: vi.fn(),
    clearColor: vi.fn(),
    clearDepth: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    depthFunc: vi.fn(),
    blendFunc: vi.fn(),
    viewport: vi.fn(),
    drawElements: vi.fn(),
    drawArrays: vi.fn(),
  }
})

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'mocked-url')
global.URL.revokeObjectURL = vi.fn()

// Mock fetch
global.fetch = vi.fn()

// Mock AudioContext
global.AudioContext = vi.fn().mockImplementation(() => ({
  createAnalyser: vi.fn(() => ({
    frequencyBinCount: 1024,
    getByteFrequencyData: vi.fn(),
  })),
  createGain: vi.fn(() => ({
    gain: { value: 1 },
    connect: vi.fn(),
  })),
  createOscillator: vi.fn(() => ({
    frequency: { value: 440 },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  })),
  destination: {},
}))

// Mock MediaRecorder
global.MediaRecorder = vi.fn().mockImplementation(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  state: 'inactive',
}))

// Mock navigator.mediaDevices
Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: vi.fn(() => []),
    }),
  },
})