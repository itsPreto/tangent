<template>
    <div class="test-panel" :class="{ 'expanded': isExpanded }">
      
      <div v-if="isExpanded" class="panel-content">
        <h3 class="panel-title">Canvas Performance Test</h3>
        
        <div class="control-row">
          <label>Number of Flowers:</label>
          <input type="number" v-model.number="flowerCount" min="1" max="1000" class="number-input" />
        </div>
        
        <div class="control-row">
          <label>Min Branches per Flower:</label>
          <input type="number" v-model.number="minBranches" min="1" max="100" class="number-input" />
        </div>
        
        <div class="control-row">
          <label>Max Branches per Flower:</label>
          <input type="number" v-model.number="maxBranches" min="1" max="100" class="number-input" />
        </div>
        
        <div class="control-row">
          <button @click="generateMockFlowers" class="generate-btn" :disabled="isGenerating">
            {{ isGenerating ? 'Generating...' : 'Generate Test Flowers' }}
          </button>
          <button @click="clearMockFlowers" class="clear-btn" :disabled="isGenerating">
            Clear Test Data
          </button>
        </div>
        
        <div class="perf-metrics">
          <div class="metric">
            <span class="metric-label">FPS:</span>
            <span class="metric-value" :class="{ 'warning': fps < 30, 'critical': fps < 15 }">{{ fps.toFixed(1) }}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Flower Count:</span>
            <span class="metric-value">{{ mockFlowers.length }}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Total Petals:</span>
            <span class="metric-value">{{ totalPetalCount }}</span>
          </div>
        </div>
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue';
  import { useChatStore } from '@/stores/chatStore';
  
  const chatStore = useChatStore();
  const isExpanded = ref(false);
  const flowerCount = ref(50);
  const minBranches = ref(5);
  const maxBranches = ref(30);
  const isGenerating = ref(false);
  const fps = ref(60);
  const lastFrameTime = ref(performance.now());
  const frameCount = ref(0);
  const fpsUpdateInterval = ref(null);
  const mockFlowers = ref([]);
  
  // Total petal count for mock flowers
  const totalPetalCount = computed(() => {
    return mockFlowers.value.reduce((total, flower) => {
      return total + flower.nodeCount;
    }, 0);
  });
  
  // Toggle panel visibility
  const togglePanel = () => {
    isExpanded.value = !isExpanded.value;
  };
  
  // Generate mock flowers with random properties
  const generateMockFlowers = async () => {
    if (isGenerating.value) return;
    isGenerating.value = true;
    
    try {
      // Clear existing mock flowers
      mockFlowers.value = [];
      
      // Create batches of mock flowers
      const batchSize = 20;
      const totalToCreate = flowerCount.value;
      let created = 0;
      
      while (created < totalToCreate) {
        const currentBatch = Math.min(batchSize, totalToCreate - created);
        const newFlowers = [];
        
        // Create a batch of flowers
        for (let i = 0; i < currentBatch; i++) {
          // Generate random branch count within specified range
          const nodeCount = Math.floor(Math.random() * 
            (maxBranches.value - minBranches.value + 1)) + minBranches.value;
          
          // Create mock flower with random properties
          newFlowers.push(createMockFlower(nodeCount));
        }
        
        // Add batch to the mockFlowers array
        mockFlowers.value.push(...newFlowers);
        created += currentBatch;
        
        // Allow UI to update between batches
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      
      // Override the chatStore.chats with our mock flowers for rendering
      chatStore.chats = [...mockFlowers.value];
      
      // Force re-layout on the next tick
      await new Promise(resolve => setTimeout(resolve, 10));
      if (typeof window.resetWorkspacePhysics === 'function') {
        window.resetWorkspacePhysics();
      }
      
      // Trigger auto-fit after generation
      if (typeof window.autoFitNodes === 'function') {
        window.autoFitNodes();
      }
    } finally {
      isGenerating.value = false;
    }
  };
  
  // Create a single mock flower
  const createMockFlower = (nodeCount) => {
    // Generate random ID
    const id = Math.random().toString(36).substring(2, 15);
    
    // Generate random title
    const title = `Test Flower ${Math.floor(Math.random() * 10000)}`;
    
    // Create the mock flower
    return {
      id,
      title,
      nodeCount,
      x: Math.random() * window.innerWidth * 0.8,
      y: Math.random() * window.innerHeight * 0.6,
      color: getRandomColor(),
      isFavorite: Math.random() > 0.8, // 20% chance to be favorite
      tags: [],
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      radius: 50 + (nodeCount / maxBranches.value) * 50 // for physics simulation
    };
  };
  
  // Clear all mock flowers
  const clearMockFlowers = async () => {
    if (isGenerating.value) return;
    
    // Clear mock flowers
    mockFlowers.value = [];
    
    // Restore original chats
    await chatStore.loadChats();
    
    // Reset layout
    if (typeof window.resetWorkspacePhysics === 'function') {
      window.resetWorkspacePhysics();
    }
    
    if (typeof window.autoFitNodes === 'function') {
      window.autoFitNodes();
    }
  };
  
  // Get random flower color
  const getRandomColor = () => {
    const colors = ['#FF5252', '#FF4081', '#E040FB', '#7C4DFF', 
                  '#536DFE', '#448AFF', '#40C4FF', '#18FFFF', 
                  '#64FFDA', '#69F0AE', '#B2FF59', '#EEFF41',
                  '#FFFF00', '#FFD740', '#FFAB40', '#FF6E40'];
    return colors[Math.floor(Math.random() * colors.length)];
  };
  
  // FPS calculation
  const calculateFPS = () => {
    const now = performance.now();
    const delta = now - lastFrameTime.value;
    frameCount.value++;
    
    if (delta >= 1000) {
      fps.value = frameCount.value / (delta / 1000);
      frameCount.value = 0;
      lastFrameTime.value = now;
    }
    
    requestAnimationFrame(calculateFPS);
  };
  
  // Watch for changes to expose global methods
  watch(
    () => mockFlowers.value.length,
    (newLength) => {
      // Make window-level properties available for other components
      window.mockFlowerCount = newLength;
      window.mockFlowerResetPhysics = () => {
        mockFlowers.value.forEach(flower => {
          flower.vx = (Math.random() - 0.5) * 20;
          flower.vy = Math.random() * 5;
        });
      };
    }
  );
  
  // Lifecycle hooks
  onMounted(() => {
    calculateFPS(); // Start FPS counter
    
    // Update FPS display regularly
    fpsUpdateInterval.value = setInterval(() => {
      // Just to trigger reactivity
      fps.value = fps.value;
    }, 500);
    
    // Make global methods available
    window.generateMockFlowers = generateMockFlowers;
    window.clearMockFlowers = clearMockFlowers;
    
    // Expose simulation methods globally
    window.updateFlowerPhysics = (resetAll = false) => {
      if (!mockFlowers.value.length) return;
      
      if (resetAll) {
        resetAllFlowerPositions();
        return;
      }
      
      // Update physics for remaining flowers
      if (typeof window.resetWorkspacePhysics === 'function') {
        window.resetWorkspacePhysics();
      }
    };
  });
  
  // Reset all flower positions
  const resetAllFlowerPositions = () => {
    const canvasWidth = window.innerWidth;
    const canvasHeight = window.innerHeight;
    
    mockFlowers.value.forEach((flower, index) => {
      // Distribute around the canvas
      const angle = (index / mockFlowers.value.length) * Math.PI * 2;
      const distance = Math.min(canvasWidth, canvasHeight) * 0.4;
      
      flower.x = canvasWidth / 2 + Math.cos(angle) * distance * Math.random();
      flower.y = canvasHeight / 2 + Math.sin(angle) * distance * Math.random();
    });
    
    chatStore.chats = [...mockFlowers.value];
  };
  
  onBeforeUnmount(() => {
    if (fpsUpdateInterval.value) {
      clearInterval(fpsUpdateInterval.value);
    }
    
    // Clean up global methods
    delete window.generateMockFlowers;
    delete window.clearMockFlowers;
    delete window.mockFlowerCount;
    delete window.mockFlowerResetPhysics;
    delete window.updateFlowerPhysics;
  });
  
  // Expose methods for parent components
  defineExpose({
    generateMockFlowers,
    clearMockFlowers
  });
  </script>
  
  <style scoped>
  .test-panel {
    position: fixed;
    top: 70px;
    right: 20px;
    background-color: var(--tw-base-100, #ffffff);
    border: 1px solid var(--tw-base-300, #d1d5db);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    overflow: hidden;
    max-width: 320px;
    transition: all 0.3s ease;
  }
  
  .toggle-btn {
    width: 100%;
    padding: 8px 16px;
    background-color: var(--tw-primary, #4f46e5);
    color: white;
    border: none;
    font-weight: 600;
    cursor: pointer;
    text-align: center;
  }
  
  .toggle-btn:hover {
    background-color: var(--tw-primary-focus, #4338ca);
  }
  
  .panel-content {
    padding: 16px;
  }
  
  .panel-title {
    margin-top: 0;
    margin-bottom: 12px;
    font-size: 16px;
    font-weight: 600;
    color: var(--tw-base-content, #111827);
  }
  
  .control-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }
  
  .number-input {
    width: 100px;
    padding: 4px 8px;
    border: 1px solid var(--tw-base-300, #d1d5db);
    border-radius: 4px;
  }
  
  .generate-btn, .clear-btn {
    padding: 6px 12px;
    border-radius: 4px;
    font-weight: 500;
    cursor: pointer;
    border: none;
  }
  
  .generate-btn {
    background-color: var(--tw-success, #10b981);
    color: white;
    flex-grow: 1;
    margin-right: 8px;
  }
  
  .generate-btn:hover:not(:disabled) {
    background-color: var(--tw-success-focus, #059669);
  }
  
  .clear-btn {
    background-color: var(--tw-error, #ef4444);
    color: white;
  }
  
  .clear-btn:hover:not(:disabled) {
    background-color: var(--tw-error-focus, #dc2626);
  }
  
  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .perf-metrics {
    margin-top: 16px;
    padding: 12px;
    background-color: var(--tw-base-200, #f3f4f6);
    border-radius: 6px;
  }
  
  .metric {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  
  .metric:last-child {
    margin-bottom: 0;
  }
  
  .metric-label {
    font-weight: 500;
    color: var(--tw-base-content-secondary, #4b5563);
  }
  
  .metric-value {
    font-family: monospace;
    font-weight: 600;
  }
  
  .warning {
    color: var(--tw-warning, #f59e0b);
  }
  
  .critical {
    color: var(--tw-error, #ef4444);
  }
  </style>