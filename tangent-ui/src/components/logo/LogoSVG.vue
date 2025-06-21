// LogoSVG.vue
<template>
  <svg viewBox="0 0 200 45" class="absolute inset-0">
    <!-- Dynamic wave patterns -->
    <path
      d="M 20 22.5 C 40 22.5, 45 12, 65 12 S 90 33, 110 33 S 135 12, 155 12 S 180 22.5, 200 22.5"
      fill="none"
      class="stroke-foreground dark:stroke-foreground"
      stroke-width="1"
    />

    <!-- Fractal-like pattern -->
    <path
      d="M 100 22.5 C 105 22.5, 110 18, 120 18 S 135 27, 145 27 S 155 18, 165 18"
      fill="none"
      class="stroke-cyan-500 dark:stroke-cyan-400"
      stroke-width="1"
    />
    <path
      d="M 100 22.5 C 95 22.5, 90 27, 80 27 S 65 18, 55 18 S 45 27, 35 27"
      fill="none"
      class="stroke-rose-500 dark:stroke-rose-400"
      stroke-width="1"
    />

    <!-- Geometric accents -->
    <path
      v-for="i in 8"
      :key="`right-${i}`"
      :d="`M ${100 + i * 10} 22.5 L ${105 + i * 10} 15 L ${110 + i * 10} 22.5`"
      fill="none"
      class="stroke-emerald-500/30 dark:stroke-emerald-400/30"
      stroke-width="0.5"
    />
    <path
      v-for="i in 8"
      :key="`left-${i}`"
      :d="`M ${100 - i * 10} 22.5 L ${95 - i * 10} 30 L ${90 - i * 10} 22.5`"
      fill="none"
      class="stroke-purple-500/30 dark:stroke-purple-400/30"
      stroke-width="0.5"
    />

    <!-- Dynamic circles -->
    <circle
      v-for="i in 5"
      :key="`right-circle-${i}`"
      :cx="100 + i * 20"
      :cy="22.5 + Math.sin(i * 1.5) * 5"
      :r="1.2 - i * 0.15"
      class="fill-cyan-500 dark:fill-cyan-400"
    />
    <circle
      v-for="i in 5"
      :key="`left-circle-${i}`"
      :cx="100 - i * 20"
      :cy="22.5 + Math.cos(i * 1.5) * 5"
      :r="1.2 - i * 0.15"
      class="fill-rose-500 dark:fill-rose-400"
    />

    <!-- Central focal point -->
    <path
      d="M 95 22.5 L 105 22.5 M 100 17.5 L 100 27.5"
      class="stroke-foreground dark:stroke-foreground"
      stroke-width="1.5"
    />
    <circle
      cx="100"
      cy="22.5"
      r="2.5"
      class="fill-foreground dark:fill-foreground"
    />

    <!-- Abstract mathematical symbols -->
    <path
      d="M 160 15 A 5 5 0 0 1 170 15 A 5 5 0 0 1 160 15"
      fill="none"
      class="stroke-emerald-500/50 dark:stroke-emerald-400/50"
      stroke-width="0.75"
    />
    <path
      d="M 30 30 A 5 5 0 0 0 40 30 A 5 5 0 0 0 30 30"
      fill="none"
      class="stroke-purple-500/50 dark:stroke-purple-400/50"
      stroke-width="0.75"
    />
  </svg>
</template>