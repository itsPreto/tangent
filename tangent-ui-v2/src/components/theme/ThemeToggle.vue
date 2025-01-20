<template>
  <div class="relative inline-block">
    <!-- Theme Dropdown -->
    <div class="relative">
      <button @click="isOpen = !isOpen"
        class="flex items-center gap-2 px-3 py-2 rounded-lg bg-background/80 backdrop-blur border shadow-sm hover:bg-muted/80 transition-all duration-200">
        <div class="flex items-center gap-2">
          <div class="flex -space-x-1">
            <div class="w-4 h-4 rounded-full border-2 border-background shadow-sm"
              :style="{ backgroundColor: getThemeColors(currentTheme).primary }" />
            <div class="w-4 h-4 rounded-full border-2 border-background shadow-sm"
              :style="{ backgroundColor: getThemeColors(currentTheme).secondary }" />
          </div>
          <span class="text-sm font-medium">{{ currentTheme.charAt(0).toUpperCase() + currentTheme.slice(1) }}</span>
        </div>
        <ChevronDown class="w-4 h-4 transition-transform duration-200" :class="{ 'rotate-180': isOpen }" />
      </button>

      <!-- Dropdown Menu -->
      <div v-if="isOpen"
        class="absolute left-0 mt-2 w-64 max-h-[60vh] overflow-y-auto rounded-lg border bg-background/95 backdrop-blur shadow-lg z-[100]">
        <div class="p-2" @click.stop>
          <input v-model="search" type="text" placeholder="Search themes..."
            class="w-full px-3 py-2 text-sm rounded-md bg-muted/50 border-0 focus:ring-1 focus:ring-primary" />
        </div>

        <div class="py-1">
          <button v-for="theme in filteredThemes" :key="theme" @click="selectTheme(theme)"
            class="w-full px-3 py-2 flex items-center gap-3 hover:bg-muted/50 transition-colors group"
            :class="{ 'bg-primary/5': theme === currentTheme }">
            <!-- Theme Preview -->
            <div class="flex items-center gap-1.5">
              <div class="w-3 h-3 rounded-full transition-transform group-hover:scale-110 duration-200"
                :style="{ backgroundColor: getThemeColors(theme).primary }" />
              <div class="w-3 h-3 rounded-full transition-transform group-hover:scale-110 duration-200"
                :style="{ backgroundColor: getThemeColors(theme).secondary }" />
              <div class="w-3 h-3 rounded-full transition-transform group-hover:scale-110 duration-200"
                :style="{ backgroundColor: getThemeColors(theme).accent }" />
            </div>

            <span class="text-sm">{{ theme.charAt(0).toUpperCase() + theme.slice(1) }}</span>

            <Check v-if="theme === currentTheme" class="w-4 h-4 ml-auto text-primary" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ChevronDown, Check } from 'lucide-vue-next';

type ThemeColors = {
  primary: string;
  secondary: string;
  accent: string;
};

type ThemeName =
  | "light" | "dark" | "cupcake" | "bumblebee" | "emerald" | "corporate"
  | "synthwave" | "retro" | "cyberpunk" | "valentine" | "halloween" | "garden"
  | "forest" | "aqua" | "lofi" | "pastel" | "fantasy" | "wireframe" | "black"
  | "luxury" | "dracula" | "cmyk" | "autumn" | "business" | "acid" | "lemonade"
  | "night" | "coffee" | "winter";

type ThemeColorMap = {
  [K in ThemeName]: ThemeColors;
};

const themes: ThemeName[] = [
  "light", "dark", "cupcake", "bumblebee", "emerald", "corporate",
  "synthwave", "retro", "cyberpunk", "valentine", "halloween",
  "garden", "forest", "aqua", "lofi", "pastel", "fantasy",
  "wireframe", "black", "luxury", "dracula", "cmyk", "autumn",
  "business", "acid", "lemonade", "night", "coffee", "winter"
];

const themeColors: ThemeColorMap = {
  // Light themes
  light: { primary: '#570DF8', secondary: '#F000B8', accent: '#37CDBE' },
  cupcake: { primary: '#65C3C8', secondary: '#EF9FBC', accent: '#EEAF3A' },
  bumblebee: { primary: '#F9D72F', secondary: '#E0A82E', accent: '#181830' },
  emerald: { primary: '#66CC8A', secondary: '#377CFB', accent: '#EA5234' },
  corporate: { primary: '#4B6BFB', secondary: '#7B92B2', accent: '#EA5234' },
  garden: { primary: '#5c7f67', secondary: '#be123c', accent: '#9CA384' },
  lofi: { primary: '#0D0D0D', secondary: '#1A1919', accent: '#4A4A4A' },
  pastel: { primary: '#d1c1d7', secondary: '#f6cbd1', accent: '#b4e9d6' },
  fantasy: { primary: '#6D0A0A', secondary: '#A65D03', accent: '#2D5A27' },
  wireframe: { primary: '#B8B8B8', secondary: '#CDCDCD', accent: '#DEDEDE' },
  lemonade: { primary: '#519903', secondary: '#E9E92E', accent: '#94CE58' },

  // Dark themes
  dark: { primary: '#793EF9', secondary: '#F471B5', accent: '#1FB2A5' },
  synthwave: { primary: '#E779C1', secondary: '#58C7F3', accent: '#F3CC30' },
  retro: { primary: '#EF9995', secondary: '#2CB67D', accent: '#7D5BA6' },
  cyberpunk: { primary: '#FF7598', secondary: '#75D1F0', accent: '#F7D51D' },
  valentine: { primary: '#E96D7B', secondary: '#A12E45', accent: '#F0AFC0' },
  halloween: { primary: '#F28C18', secondary: '#6B21A8', accent: '#37CDBE' },
  forest: { primary: '#1EB854', secondary: '#1DB88E', accent: '#1EA885' },
  aqua: { primary: '#09ECF3', secondary: '#0771DE', accent: '#07ABE3' },
  black: { primary: '#333333', secondary: '#666666', accent: '#999999' },
  luxury: { primary: '#DAA520', secondary: '#B8860B', accent: '#FFD700' },
  dracula: { primary: '#FF79C6', secondary: '#BD93F9', accent: '#50FA7B' },
  cmyk: { primary: '#00BCD4', secondary: '#FF4081', accent: '#FFEB3B' },
  autumn: { primary: '#8B4513', secondary: '#A0522D', accent: '#CD853F' },
  business: { primary: '#1C4E80', secondary: '#7C909A', accent: '#A6B0B5' },
  acid: { primary: '#FF00FF', secondary: '#00FF00', accent: '#FFFF00' },
  night: { primary: '#38BDF8', secondary: '#818CF8', accent: '#C084FC' },
  coffee: { primary: '#6F4E37', secondary: '#C6A880', accent: '#DAC3B3' },
  winter: { primary: '#0EA5E9', secondary: '#84CC16', accent: '#10B981' }
};

const isOpen = ref(false);
const search = ref('');
const currentTheme = ref<ThemeName>(
  (localStorage.getItem('theme') as ThemeName) || 'light'
);

const getThemeColors = (theme: ThemeName): ThemeColors => {
  return themeColors[theme];
};

const filteredThemes = computed(() => {
  const searchTerm = search.value.toLowerCase();
  return themes.filter(theme =>
    theme.toLowerCase().includes(searchTerm)
  );
});

const selectTheme = (theme: ThemeName) => {
  currentTheme.value = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  isOpen.value = false;
};

onMounted(() => {
  const savedTheme = localStorage.getItem('theme') as ThemeName || 'light';
  currentTheme.value = savedTheme;
  document.documentElement.setAttribute('data-theme', savedTheme);
});
</script>

<style scoped>
div::-webkit-scrollbar {
  width: 6px;
}

div::-webkit-scrollbar-track {
  background: transparent;
}

div::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.dark div::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.2);
}
</style>