<template>
    <div class="relative w-full h-full" :class="{ 'fullscreen-preview': isFullscreen }">
        <!-- Preview Header -->
        <PreviewHeader :current-index="currentIndex" :total-relics="totalRelics" :show-navigation="showNavigation"
            :fps-counter="fpsCounter" @previous="$emit('previous')" @next="$emit('next')" @refresh="$emit('refresh')"
            @fullscreen="toggleFullscreen" />

        <!-- Preview Content -->
        <div class="preview-content-wrapper" ref="previewWrapper">
            <slot></slot>
        </div>
    </div>

    <!-- Teleport the fullscreen preview outside the SidePanel hierarchy when active -->
    <Teleport to="body" :disabled="!isFullscreen">
        <div v-if="isFullscreen" class="fullscreen-container">
            <div class="fullscreen-overlay"></div>
            <div class="absolute-fullscreen-preview">
                <!-- Duplicate the header for the fullscreen view -->
                <PreviewHeader :current-index="currentIndex" :total-relics="totalRelics" :show-navigation="showNavigation"
                    :fps-counter="fpsCounter" @previous="$emit('previous')" @next="$emit('next')" @refresh="$emit('refresh')"
                    @fullscreen="toggleFullscreen" />
                
                <!-- Clone the content for fullscreen view -->
                <div class="preview-content-wrapper fullscreen-content">
                    <slot></slot>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import PreviewHeader from './SandPackHeader.vue';

const props = defineProps({
    currentIndex: {
        type: Number,
        default: 0
    },
    totalRelics: {
        type: Number,
        default: 0
    },
    showNavigation: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['previous', 'next', 'refresh']);

const isFullscreen = ref(false);
const previewWrapper = ref(null);
const fpsCounter = ref('');
const fpsUpdateInterval = ref(null);

const toggleFullscreen = (value) => {
    isFullscreen.value = value;

    // Apply fullscreen styles and adjust parent containers
    if (isFullscreen.value) {
        document.body.classList.add('preview-fullscreen-active');
    } else {
        document.body.classList.remove('preview-fullscreen-active');
    }

    // Allow a moment for DOM updates before triggering any resize events
    setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
    }, 100);
};

// FPS monitoring logic
const setupFpsMonitoring = () => {
    if (!previewWrapper.value) return;

    let frameCount = 0;
    let lastTime = performance.now();
    let frameRate = 0;
    let frameRateMin = Infinity;
    let frameRateMax = 0;

    // Update frame counter
    const updateFps = () => {
        const now = performance.now();
        const delta = now - lastTime;

        // Calculate FPS every second
        if (delta > 1000) {
            frameRate = Math.round((frameCount * 1000) / delta);

            // Track min/max
            frameRateMin = Math.min(frameRateMin, frameRate);
            frameRateMax = Math.max(frameRateMax, frameRate);

            // Update display
            fpsCounter.value = `${frameRate} FPS (${frameRateMin}-${frameRateMax})`;

            // Reset for next measurement
            frameCount = 0;
            lastTime = now;
        }

        frameCount++;
        requestAnimationFrame(updateFps);
    };

    // Start monitoring
    updateFps();

    // Reset min/max occasionally
    fpsUpdateInterval.value = setInterval(() => {
        frameRateMin = Infinity;
        frameRateMax = 0;
    }, 30000); // Reset every 30 seconds
};

// Keyboard shortcut for fullscreen (ESC to exit)
const handleKeydown = (e) => {
    if (e.key === 'Escape' && isFullscreen.value) {
        toggleFullscreen(false);
    } else if (e.key === 'f' && (e.ctrlKey || e.metaKey)) {
        // Ctrl+F or Cmd+F for fullscreen
        e.preventDefault();
        toggleFullscreen(!isFullscreen.value);
    }
};

onMounted(() => {
    window.addEventListener('keydown', handleKeydown);
    setupFpsMonitoring();
});

onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleKeydown);
    if (fpsUpdateInterval.value) {
        clearInterval(fpsUpdateInterval.value);
    }
});
</script>

<style scoped>
.preview-content-wrapper {
    position: relative;
    width: 100%;
    height: calc(100% - 36px);
    /* Adjust for header height */
    overflow: hidden;
    transition: all 0.3s ease;
}

/* For the fallback fullscreen in the original container */
.fullscreen-preview {
    position: relative; /* Changed from fixed to avoid overlapping the teleported content */
    width: 100%;
    height: 100%;
}

/* The fullscreen container that gets teleported to body */
.fullscreen-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 99999; /* Extremely high z-index to ensure it's on top */
    display: flex;
    flex-direction: column;
}

.fullscreen-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(0, 0, 0, 0.95);
    z-index: 99998;
}

.absolute-fullscreen-preview {
    position: relative;
    width: 100vw;
    height: 100vh;
    z-index: 99999;
    display: flex;
    flex-direction: column;
}

.fullscreen-content {
    flex: 1;
    height: calc(100vh - 36px); /* Account for header */
}

/* When fullscreen is active, adjust body scroll */
:global(body.preview-fullscreen-active) {
    overflow: hidden;
    pointer-events: none; /* Prevents interaction with background elements */
}

:global(body.preview-fullscreen-active .fullscreen-container) {
    pointer-events: auto; /* Re-enables interaction only for the fullscreen container */
}

/* Fix for SandpackPreview inside the wrapper */
:deep(.sp-preview-container) {
    height: 100% !important;
    width: 100% !important;
}

:deep(.sp-preview) {
    height: 100% !important;
    width: 100% !important;
}

/* Apply these styles specifically in fullscreen mode */
.fullscreen-content :deep(.sp-preview-container),
.fullscreen-content :deep(.sp-preview),
.fullscreen-content :deep(.sp-preview iframe) {
    width: 100vw !important;
    max-height: calc(100vh - 36px) !important;
    border-radius: 0 !important;
}
</style>