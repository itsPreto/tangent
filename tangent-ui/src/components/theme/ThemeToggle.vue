<template>
  <div class="relative inline-block theme-toggle" :class="'theme-' + currentTheme">
    <!-- Theme Dropdown -->
    <div class="relative">
      <button @click="isOpen = !isOpen"
        class="flex items-center gap-2 rounded-lg transition-all duration-200 theme-toggle-button"
        :style="toggleButtonStyle">
        <div class="flex items-center gap-2">
          <div class="flex -space-x-1">
            <div class="w-4 h-4 rounded-full border-2 shadow-sm theme-color-dot"
              :style="{ 
                backgroundColor: getThemeColors(currentTheme).primary,
                borderColor: isDarkTheme ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'
              }" />
            <div class="w-4 h-4 rounded-full border-2 shadow-sm theme-color-dot"
              :style="{ 
                backgroundColor: getThemeColors(currentTheme).secondary,
                borderColor: isDarkTheme ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'
              }" />
          </div>
          <span class="text-sm font-medium theme-name">{{ currentTheme.charAt(0).toUpperCase() + currentTheme.slice(1) }}</span>
        </div>
        <ChevronDown class="w-4 h-4 transition-transform duration-200" :class="{ 'rotate-180': isOpen }" />
      </button>

      <!-- Dropdown Menu -->
      <div v-if="isOpen"
        class="absolute left-0 mt-2 w-64 max-h-[60vh] overflow-y-auto rounded-lg border shadow-lg z-[100] theme-dropdown"
        :style="dropdownStyle"
        @click.stop>
        <div class="p-2 search-container" :style="searchContainerStyle">
          <div class="relative">
            <Search class="absolute left-3 top-2.5 w-4 h-4 search-icon" :style="{ color: searchIconColor }" />
            <input v-model="search" type="text" placeholder="Search themes..."
              class="w-full px-3 py-2 pl-9 text-sm rounded-md border-0 focus:ring-1 focus:outline-none search-input"
              :style="searchInputStyle" />
          </div>
        </div>

        <div class="py-1 themes-list">
          <button v-for="theme in filteredThemes" :key="theme" @click="selectTheme(theme)"
            class="w-full px-3 py-2 flex items-center gap-3 transition-colors group theme-option"
            :class="{ 'selected-theme': theme === currentTheme }"
            :style="getThemeOptionStyle(theme)">
            <!-- Theme Preview -->
            <div class="flex items-center gap-1.5">
              <div class="w-3 h-3 rounded-full transition-transform group-hover:scale-110 duration-200 theme-preview-dot"
                :style="{ backgroundColor: getThemeColors(theme).primary }" />
              <div class="w-3 h-3 rounded-full transition-transform group-hover:scale-110 duration-200 theme-preview-dot"
                :style="{ backgroundColor: getThemeColors(theme).secondary }" />
              <div class="w-3 h-3 rounded-full transition-transform group-hover:scale-110 duration-200 theme-preview-dot"
                :style="{ backgroundColor: getThemeColors(theme).accent }" />
            </div>

            <span class="text-sm theme-option-name">{{ theme.charAt(0).toUpperCase() + theme.slice(1) }}</span>

            <Check v-if="theme === currentTheme" class="w-4 h-4 ml-auto text-primary" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { ChevronDown, Check, Search } from 'lucide-vue-next';

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

// Dark themes list for special styling
const darkThemes = [
  'dark', 'synthwave', 'retro', 'cyberpunk', 'halloween',
  'forest', 'aqua', 'black', 'luxury', 'dracula', 'cmyk',
  'autumn', 'business', 'acid', 'night', 'coffee'
];

const isOpen = ref(false);
const search = ref('');
const currentTheme = ref<ThemeName>(
  (localStorage.getItem('theme') as ThemeName) || 'light'
);

// Theme observer for real-time updates
let themeObserver: MutationObserver | null = null;

// Check if current theme is dark
const isDarkTheme = computed(() => {
  return darkThemes.includes(currentTheme.value);
});

// Dynamic styling based on current theme
const toggleButtonStyle = computed(() => {
  const primaryColor = getThemeColors(currentTheme.value).primary;
  const secondaryColor = getThemeColors(currentTheme.value).secondary;
  
  let bgColor = isDarkTheme.value ? 'rgba(30, 30, 35, 0.7)' : 'rgba(245, 245, 250, 0.7)';
  let borderColor = isDarkTheme.value ? 'rgba(80, 80, 90, 0.3)' : 'rgba(200, 200, 210, 0.5)';
  let textColor = isDarkTheme.value ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)';
  let shadowColor = isDarkTheme.value ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.1)';
  
  // Special themes
  if (currentTheme.value === 'cyberpunk') {
    bgColor = 'rgba(20, 20, 30, 0.8)';
    borderColor = `${primaryColor}70`;
    textColor = primaryColor;
    shadowColor = `${primaryColor}40`;
  } else if (currentTheme.value === 'synthwave') {
    bgColor = 'rgba(40, 20, 60, 0.7)';
    borderColor = `${secondaryColor}60`;
    textColor = secondaryColor;
    shadowColor = `${secondaryColor}40`;
  } else if (currentTheme.value === 'aqua') {
    bgColor = 'rgba(0, 60, 90, 0.6)';
    borderColor = `${primaryColor}80`;
    textColor = primaryColor;
    shadowColor = `${primaryColor}30`;
  }
  
  return {
    backgroundColor: bgColor,
    borderColor: borderColor,
    color: textColor,
    boxShadow: `0 2px 6px ${shadowColor}`,
    backdropFilter: 'blur(8px)',
    padding: '0.5rem 0.75rem',
    borderWidth: '1px',
    borderStyle: 'solid'
  };
});

const dropdownStyle = computed(() => {
  const primaryColor = getThemeColors(currentTheme.value).primary;
  
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(20, 20, 25, 0.95)' : 'rgba(250, 250, 255, 0.95)',
    borderColor: isDarkTheme.value ? 'rgba(70, 70, 80, 0.3)' : 'rgba(210, 210, 220, 0.5)',
    color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)',
    backdropFilter: 'blur(10px)',
    boxShadow: isDarkTheme.value 
      ? '0 8px 20px rgba(0, 0, 0, 0.4)' 
      : '0 8px 20px rgba(0, 0, 0, 0.1)',
    maxHeight: '60vh',
    scrollbarColor: `${adjustColorOpacity(primaryColor, 0.3)} transparent`,
    scrollbarWidth: 'thin'
  };
});

const searchContainerStyle = computed(() => {
  return {
    borderBottom: isDarkTheme.value 
      ? '1px solid rgba(80, 80, 90, 0.2)' 
      : '1px solid rgba(220, 220, 230, 0.5)'
  };
});

const searchInputStyle = computed(() => {
  const primaryColor = getThemeColors(currentTheme.value).primary;
  
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(40, 40, 50, 0.5)' : 'rgba(240, 240, 250, 0.5)',
    color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)',
    '::placeholder': {
      color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)'
    },
    '--tw-ring-color': adjustColorOpacity(primaryColor, 0.4)
  };
});

const searchIconColor = computed(() => {
  return isDarkTheme.value ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.4)';
});

const getThemeOptionStyle = (theme: ThemeName) => {
  const isSelected = theme === currentTheme.value;
  const primaryColor = getThemeColors(theme).primary;
  
  if (isSelected) {
    return {
      backgroundColor: isDarkTheme.value 
        ? adjustColorOpacity(primaryColor, 0.15) 
        : adjustColorOpacity(primaryColor, 0.1),
      color: isDarkTheme.value ? 'white' : 'black'
    };
  }
  
  return {
    backgroundColor: 'transparent',
    color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)',
    '&:hover': {
      backgroundColor: isDarkTheme.value ? 'rgba(60, 60, 70, 0.4)' : 'rgba(240, 240, 250, 0.7)'
    }
  };
};

// Helper function to adjust color opacity
function adjustColorOpacity(hexColor: string, opacity: number): string {
  // Convert hex to rgb
  let r, g, b;
  
  // Check if it's a valid hex color
  if (!/^#([A-Fa-f0-9]{3}){1,2}$/.test(hexColor)) {
    // Return a fallback if not a valid hex
    return `rgba(128, 128, 128, ${opacity})`;
  }
  
  // Convert short hex to full form
  const hex = hexColor.replace('#', '');
  if (hex.length === 3) {
    r = parseInt(hex.charAt(0) + hex.charAt(0), 16);
    g = parseInt(hex.charAt(1) + hex.charAt(1), 16);
    b = parseInt(hex.charAt(2) + hex.charAt(2), 16);
  } else {
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  }
  
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

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

// Update theme from DOM for reactivity
const updateThemeFromDOM = () => {
  const newTheme = document.documentElement.getAttribute('data-theme') as ThemeName || 'light';
  if (newTheme !== currentTheme.value) {
    currentTheme.value = newTheme;
  }
};

// Close dropdown when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  if (isOpen.value && !event.composedPath().includes(document.querySelector('.theme-toggle') as Node)) {
    isOpen.value = false;
  }
};

onMounted(() => {
  const savedTheme = localStorage.getItem('theme') as ThemeName || 'light';
  currentTheme.value = savedTheme;
  document.documentElement.setAttribute('data-theme', savedTheme);
  
  // Setup theme observer for real-time updates
  themeObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'data-theme') {
        updateThemeFromDOM();
      }
    });
  });

  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  });
  
  // Add click outside listener
  document.addEventListener('click', handleClickOutside);
});

onBeforeUnmount(() => {
  if (themeObserver) {
    themeObserver.disconnect();
  }
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
.theme-toggle {
  position: relative;
  z-index: 50;
}

.theme-toggle-button {
  position: relative;
  z-index: 51;
  transition: all 0.2s ease;
}

.theme-toggle-button:hover {
  transform: translateY(-1px);
}

.theme-toggle-button:active {
  transform: translateY(0);
}

.theme-color-dot {
  transition: transform 0.3s ease;
}

.theme-toggle-button:hover .theme-color-dot {
  transform: scale(1.1);
}

.theme-dropdown {
  scrollbar-width: thin;
  transition: background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
}

.theme-dropdown::-webkit-scrollbar {
  width: 6px;
}

.theme-dropdown::-webkit-scrollbar-track {
  background: transparent;
}

.theme-dropdown::-webkit-scrollbar-thumb {
  background-color: rgba(var(--p), 0.2);
  border-radius: 3px;
}

.search-input {
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.search-input:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(var(--p), 0.2);
}

.theme-option {
  transition: background-color 0.2s ease;
  position: relative;
  overflow: hidden;
}

.theme-option:hover::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(to right, transparent, rgba(var(--p), 0.05));
  pointer-events: none;
}

.theme-option:active {
  transform: translateY(1px);
}

.selected-theme {
  position: relative;
}

.selected-theme::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background-color: var(--p);
}

.theme-preview-dot {
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

/* Theme-specific styling */
.theme-cyberpunk .theme-option:hover::after {
  background: linear-gradient(90deg, transparent, rgba(255, 117, 152, 0.1));
}

.theme-synthwave .theme-dropdown {
  background: linear-gradient(135deg, rgba(40, 20, 60, 0.95), rgba(80, 30, 110, 0.9));
}

.theme-aqua .theme-dropdown {
  box-shadow: 0 8px 30px rgba(9, 236, 243, 0.15);
}

.theme-valentine .theme-toggle-button,
.theme-cupcake .theme-toggle-button {
  border-radius: 1rem;
}

.theme-retro .theme-toggle-button {
  border-style: double;
  border-width: 3px;
}

.theme-dracula .theme-dropdown {
  background-color: rgba(35, 35, 45, 0.95);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 15px rgba(255, 121, 198, 0.1);
}

.theme-luxury .theme-dropdown {
  border-color: rgba(218, 165, 32, 0.3);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 15px rgba(218, 165, 32, 0.2);
}
</style>