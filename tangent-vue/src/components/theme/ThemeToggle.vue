<template>
  <button @click="toggleTheme"
    class="fixed top-4 left-4 p-2 rounded-full bg-background/80 backdrop-blur border shadow-sm hover:bg-muted/80 transition-colors z-20">
    <div class="relative w-5 h-5">
      <Sun
        class="w-5 h-5 transition-all duration-200 rotate-0 scale-100 dark:-rotate-90 dark:scale-0 text-yellow-500" />
      <Moon
        class="absolute top-0 w-5 h-5 transition-all duration-200 rotate-90 scale-0 dark:rotate-0 dark:scale-100 text-yellow-500" />
    </div>
    <span class="sr-only">Toggle theme</span>
  </button>
</template>

<script setup>
import { onMounted } from 'vue';
import { Moon, Sun } from 'lucide-vue-next';

const toggleTheme = () => {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  const newTheme = isDark ? 'light' : 'dark';

  // Update both DaisyUI's data-theme and Tailwind's dark class
  html.setAttribute('data-theme', newTheme);
  html.classList.remove(isDark ? 'dark' : 'light');
  html.classList.add(newTheme);

  localStorage.setItem('theme', newTheme);
};

onMounted(() => {
  // Initialize theme based on localStorage or system preference
  const theme = localStorage.getItem('theme') ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

  // Set both DaisyUI's data-theme and Tailwind's dark class
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.classList.add(theme);

  // Add listener for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const newTheme = e.matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(newTheme);
    localStorage.setItem('theme', newTheme);
  });
});
</script>

<style scoped>
.dark .dark\:rotate-0 {
  transform: rotate(0deg);
}

.dark .dark\:scale-0 {
  transform: scale(0);
}

.dark .dark\:scale-100 {
  transform: scale(1);
}
</style>