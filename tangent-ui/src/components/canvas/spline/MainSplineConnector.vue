<template>
  <g class="pointer-events-auto">
    <!-- Main dashed path -->
    <path
      :d="pathData"
      :stroke="isActive ? glowColor : '#94a3b8'"
      :stroke-width="strokeWidth"
      :stroke-dasharray="dashPattern"
      fill="none"
      opacity="0.4"
      class="transition-all duration-200"
    />

    <!-- Particles -->
    <g v-for="particle in particles" :key="particle.id">
      <circle
        v-if="!isNaN(particle.x) && !isNaN(particle.y) && !isNaN(particleRadius)"
        :cx="particle.x"
        :cy="particle.y"
        :r="particleRadius"
        :fill="isActive ? glowColor : '#94a3b8'"
      >
        <animate
          attributeName="opacity"
          values="1;0.3;1"
          :dur="particle.duration"
          repeatCount="indefinite"
        />
      </circle>
    </g>

    <!-- Hidden path for text alignment -->
    <path
      :id="`connection-path-${startNode.id}-${endNode.id}`"
      :d="isLeftBranch ? reversedPathData : pathData"
      fill="none"
      stroke="none"
      pointer-events="none"
    />

    <!-- Label + inline editor -->
    <g class="label-container" style="pointer-events:auto;z-index:10">
      <text class="text-container" style="pointer-events:none">
        <textPath
          :href="`#connection-path-${startNode.id}-${endNode.id}`"
          startOffset="50%"
          text-anchor="middle"
          :class="{ reversed: isLeftBranch }"
        >
          <tspan :dy="-12" :style="[labelStyle, { pointerEvents: 'auto' }]" class="label-text">
            <tspan
              v-if="!isEditing"
              class="label-background"
              @dblclick.stop="handleLabelDoubleClick"
            >
              {{ getLabelText() }}
            </tspan>
          </tspan>
        </textPath>
      </text>

      <foreignObject
        v-if="isEditing"
        :x="calculateLabelPosition().x"
        :y="calculateLabelPosition().y"
        :width="300 / Math.min(1, zoomLevel)"
        :height="50 / Math.min(1, zoomLevel)"
        @dblclick.stop
        style="z-index:20;pointer-events:auto"
      >
        <div xmlns="http://www.w3.org/2000/svg" class="flex items-center justify-center w-full h-full">
          <input
            ref="inputRef"
            v-model="labelInput"
            @blur="handleLabelBlur"
            @keydown="handleKeyDown"
            class="bg-base-100 border border-base-300 rounded px-3 py-2 text-center w-full"
            :style="[inputStyle, { pointerEvents: 'auto' }]"
          />
        </div>
      </foreignObject>
    </g>
  </g>
</template>

<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  onMounted,
  onBeforeUnmount,
  nextTick
} from 'vue'
import emitter from '@/utils/eventBus'
import { debounce } from 'lodash'

/* ----------------‑ props -------------- */
const props = defineProps({
  startNode: { type: Object, required: true },
  endNode: { type: Object, required: true },
  cardWidth: { type: Number, required: true },
  cardHeight: { type: Number, required: true },
  isActive: { type: Boolean, default: false },
  zoomLevel: { type: Number, default: 1 },
  isSourceNodeExpanded: { type: Boolean, default: true }
})

/* ----------------‑ refs / state -------------- */
const isEditing = ref(false)
const labelInput = ref('')
const customLabel = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const particles = ref<Particle[]>([])

let animationFrame: number | null = null
let loopGen = 0          // generation counter
let isVisible = true     // IntersectionObserver flag

/* ----------------‑ constants -------------- */
const baseStroke = 1.5
const baseFontSize = 14
const baseParticleRadius = 3
const baseParticleSpeed = 0.002
const numParticles = 4
const labelOffset = 12

/* ----------------‑ geometry helpers -------------- */
const isLeftBranch = computed(() => props.endNode.type === 'left-branch')

function calculateConnectionPoints() {
  const idx = props.endNode.branchMessageIndex ?? 0
  const yOff = props.isSourceNodeExpanded ? idx * 120 + 40 : 40

  const startPoint = {
    x: isLeftBranch.value
      ? props.startNode.x - 1
      : props.startNode.x + props.cardWidth + 1,
    y: props.startNode.y + yOff
  }

  const endPoint = {
    x: props.endNode.x + (isLeftBranch.value ? props.cardWidth : 0),
    y: props.endNode.y + props.cardHeight / 2
  }

  return { startPoint, endPoint }
}

const pathAndControlPoints = computed(() => {
  const { startPoint, endPoint } = calculateConnectionPoints()
  const dx = endPoint.x - startPoint.x
  const dy = endPoint.y - startPoint.y
  const dist = Math.hypot(dx, dy)
  const cpDist = Math.min(dist * 0.8, 200)
  const vert = Math.min(Math.abs(dy), 100) * (dy < 0 ? -1 : 1)

  const controlPoint1 = {
    x: startPoint.x + (isLeftBranch.value ? -cpDist : cpDist),
    y: startPoint.y + vert
  }
  const controlPoint2 = {
    x: endPoint.x + (isLeftBranch.value ? cpDist : -cpDist),
    y: endPoint.y - vert
  }

  const path = `M ${startPoint.x} ${startPoint.y}
                C ${controlPoint1.x} ${controlPoint1.y},
                  ${controlPoint2.x} ${controlPoint2.y},
                  ${endPoint.x} ${endPoint.y}`

  return { startPoint, endPoint, controlPoint1, controlPoint2, path }
})

const pathData = computed(() => pathAndControlPoints.value.path)
const reversedPathData = computed(() => {
  const { startPoint, endPoint, controlPoint1, controlPoint2 } =
    pathAndControlPoints.value
  return `M ${endPoint.x} ${endPoint.y}
          C ${controlPoint2.x} ${controlPoint2.y},
            ${controlPoint1.x} ${controlPoint1.y},
            ${startPoint.x} ${startPoint.y}`
})

/* ----------------‑ styling computed -------------- */
const strokeWidth = computed(() => {
  const scale = 1 / Math.pow(props.zoomLevel, 1.2)
  return baseStroke * Math.min(scale, 4)
})
const dashPattern = computed(() => {
  const scale = 1 / Math.pow(props.zoomLevel, 1.2)
  return `${4 * Math.min(scale, 4)} ${6 * Math.min(scale, 4)}`
})
const particleRadius = computed(() => {
  const scale = 1 / Math.pow(props.zoomLevel, 2.2)
  return baseParticleRadius * Math.min(scale, 3)
})
const fontSize = computed(() =>
  Math.max(baseFontSize * (1 / Math.min(1, props.zoomLevel)), baseFontSize)
)
const labelStyle = computed(() => ({
  fontSize: `${fontSize.value}px`,
  fontWeight: 500
}))
const inputStyle = labelStyle

/* theme glow */
const glowColor = computed(() =>
  getComputedStyle(document.documentElement)
    .getPropertyValue('--glow-color')
    .trim()
)

/* ----------------‑ label helpers -------------- */
function getLabelText() {
  if (customLabel.value) return customLabel.value
  const idx = props.endNode.branchMessageIndex ?? 0
  const msg = props.startNode.messages?.[idx]?.content ?? ''
  const words = msg.split(' ').slice(0, 3).join(' ')
  return words.length > 20 ? `${words.slice(0, 20)}…` : words || `Branch ${idx + 1}`
}

const inputWidth = computed(() => {
  const w = labelInput.value.length * fontSize.value * 0.6
  return Math.max(50, Math.min(300 / props.zoomLevel, w / props.zoomLevel))
})
const inputHeight = computed(() => (fontSize.value * 1.5) / props.zoomLevel)

function calculateLabelPosition() {
  const { startPoint, endPoint } = calculateConnectionPoints()
  const midX =
    startPoint.x + (endPoint.x - startPoint.x) / 2 +
    (isLeftBranch.value ? -inputWidth.value : 0)
  const midY =
    startPoint.y + (endPoint.y - startPoint.y) / 2 -
    inputHeight.value / 2 -
    labelOffset
  return { x: midX, y: midY }
}

/* label edit handlers */
function handleLabelDoubleClick(e: MouseEvent) {
  e.stopPropagation()
  e.preventDefault()
  if (!isEditing.value) {
    isEditing.value = true
    labelInput.value = customLabel.value || getLabelText()
    nextTick(() => inputRef.value?.focus())
  }
}
function handleLabelBlur() {
  if (labelInput.value.trim()) customLabel.value = labelInput.value.trim()
  isEditing.value = false
}
function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter') handleLabelBlur()
  else if (e.key === 'Escape') isEditing.value = false
}

/* ----------------‑ particle engine -------------- */
interface Particle {
  id: number
  progress: number
  speed: number
  duration: string
  x: number
  y: number
}

function getParticleSpeed() {
  const scale = 1 / Math.max(0.5, props.zoomLevel)
  return Math.min(baseParticleSpeed * scale, baseParticleSpeed * 3)
}

function initializeParticles() {
  const base = getParticleSpeed()
  const arr: Particle[] = []
  for (let i = 0; i < numParticles; i++) {
    arr.push({
      id: i,
      progress: i / numParticles,
      speed: base + Math.random() * base * 0.5, // constant per particle
      duration: `${0.8 + Math.random() * 0.4}s`,
      x: 0,
      y: 0
    })
  }
  particles.value = arr
}

/* -------- RAF loop with generation check -------- */
function animateParticles(myGen: number) {
  if (myGen !== loopGen) return // a newer reset started; kill this loop

  if (!pathAndControlPoints.value || props.zoomLevel < 0.1) {
    animationFrame = requestAnimationFrame(() => animateParticles(myGen))
    return
  }

  const { startPoint, endPoint, controlPoint1, controlPoint2 } =
    pathAndControlPoints.value

  particles.value.forEach(p => {
    p.progress += p.speed
    if (p.progress > 1) p.progress -= 1

    const t = p.progress
    const t1 = 1 - t
    p.x =
      t1 * t1 * t1 * startPoint.x +
      3 * t1 * t1 * t * controlPoint1.x +
      3 * t1 * t * t * controlPoint2.x +
      t * t * t * endPoint.x
    p.y =
      t1 * t1 * t1 * startPoint.y +
      3 * t1 * t1 * t * controlPoint1.y +
      3 * t1 * t * t * controlPoint2.y +
      t * t * t * endPoint.y
  })

  animationFrame = requestAnimationFrame(() => animateParticles(myGen))
}

/* -------- reset & watchers -------- */
function resetAnimation() {
  loopGen++ // invalidate old loop
  if (animationFrame !== null) {
    cancelAnimationFrame(animationFrame)
    animationFrame = null
  }
  initializeParticles()
  animateParticles(loopGen)
}

const debouncedResetAnimation = debounce(resetAnimation, 100)

watch(
  () => [
    props.startNode.x,
    props.startNode.y,
    props.endNode.x,
    props.endNode.y,
    props.zoomLevel
  ],
  () => debouncedResetAnimation()
)

/* -------- IntersectionObserver -------- */
function setupObserver() {
  if (typeof IntersectionObserver === 'undefined') return
  const id = `connection-path-${props.startNode.id}-${props.endNode.id}`
  const svg = document.querySelector(`#${id}`)?.closest('svg')
  if (!svg) return
  const obs = new IntersectionObserver(
    es => (isVisible = es[0].isIntersecting),
    { threshold: 0.1 }
  )
  obs.observe(svg)
  return () => obs.disconnect()
}

/* -------- lifecycle -------- */
onMounted(() => {
  const stopObs = setupObserver()
  emitter.on('workspace-opened', resetAnimation)

  resetAnimation() // first run

  onBeforeUnmount(() => {
    if (animationFrame !== null) cancelAnimationFrame(animationFrame)
    stopObs && stopObs()
    emitter.off('workspace-opened', resetAnimation)
    debouncedResetAnimation.cancel()
  })
})
</script>

<style scoped>
.text-container {
  pointer-events: none;
}
.label-text {
  fill: var(--color-base-content);
  opacity: 0.8;
}
.label-background {
  pointer-events: all;
  cursor: pointer;
  background: var(--color-base-100);
  padding: 8px 16px;
  border-radius: 6px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
.label-background:hover {
  background: var(--color-base-200);
}

input {
  transition: all 0.2s ease;
  pointer-events: auto;
  z-index: 30;
  position: relative;
}
input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary / 0.2);
}
textPath.reversed {
  transform: scale(1, -1);
}
.label-container {
  isolation: isolate;
}
.label-container * {
  touch-action: manipulation;
}
</style>
