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
      <Teleport to="body">
        <div v-if="isOpen"
          class="fixed w-64 max-h-[60vh] overflow-y-auto rounded-lg border shadow-lg theme-dropdown"
          style="z-index: 99999;"
          :style="{ ...dropdownStyle, ...dropdownPosition }"
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
      </Teleport>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { ChevronDown, Check, Search } from 'lucide-vue-next';
import { useThemeStore } from '@/stores/themeStore';

type ThemeColors = {
  primary: string;
  secondary: string;
  accent: string;
};

type ThemeName =
  | "light" | "dark" | "cupcake" | "bumblebee" | "emerald" | "corporate"
  | "synthwave" | "retro" | "cyberpunk" | "valentine" | "halloween" | "garden"
  | "forest" | "aqua" | "lofi" | "pastel" | "fantasy" | "wireframe" | "black"
  | "luxury" | "neon" | "dracula" | "cmyk" | "autumn" | "business" | "acid" | "lemonade"
  | "night" | "coffee" | "winter";

type ThemeColorMap = {
  [K in ThemeName]: ThemeColors;
};

const themes: ThemeName[] = [
  "light", "dark", "cupcake", "bumblebee", "emerald", "corporate",
  "synthwave", "retro", "cyberpunk", "valentine", "halloween",
  "garden", "forest", "aqua", "lofi", "pastel", "fantasy",
  "wireframe", "black", "luxury", "neon", "dracula", "cmyk", "autumn",
  "business", "acid", "lemonade", "night", "coffee", "winter"
];

// Use theme store for all colors

// Dark themes list for special styling
const darkThemes = [
  'dark', 'synthwave', 'retro', 'cyberpunk', 'halloween',
  'forest', 'aqua', 'black', 'luxury', 'neon', 'dracula', 'cmyk',
  'autumn', 'business', 'acid', 'night', 'coffee'
];

const themeStore = useThemeStore();

const isOpen = ref(false);
const search = ref('');

// Use theme store instead of local state
const currentTheme = computed(() => themeStore.currentTheme);

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
  console.log('Getting colors for theme:', theme, themeStore.getThemeColors(theme));
  return themeStore.getThemeColors(theme);
};

const dropdownPosition = ref({});

const updateDropdownPosition = () => {
  if (typeof window === 'undefined') return;
  
  const button = document.querySelector('.theme-toggle-button');
  if (!button) return;
  
  const rect = button.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const dropdownWidth = 256; // 16rem (w-64)
  
  let left = rect.left;
  if (left + dropdownWidth > viewportWidth - 16) {
    left = viewportWidth - dropdownWidth - 16;
  }
  
  dropdownPosition.value = {
    top: `${rect.bottom + 8}px`,
    left: `${Math.max(16, left)}px`
  };
};

watch(isOpen, (newValue) => {
  if (newValue) {
    nextTick(() => {
      updateDropdownPosition();
    });
  }
});

const filteredThemes = computed(() => {
  const searchTerm = search.value.toLowerCase();
  return themes.filter(theme =>
    theme.toLowerCase().includes(searchTerm)
  );
});

const selectTheme = (theme: ThemeName) => {
  themeStore.setTheme(theme as any);
  isOpen.value = false;
};

// Theme is now managed by the theme store

// Close dropdown when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  if (isOpen.value && !event.composedPath().includes(document.querySelector('.theme-toggle') as Node)) {
    isOpen.value = false;
  }
};

onMounted(() => {
  // Theme is initialized by the theme store in main.ts
  // Add click outside listener
  document.addEventListener('click', handleClickOutside);
});

onBeforeUnmount(() => {
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

.theme-neon .theme-dropdown {
  background-color: rgba(35, 35, 45, 0.95);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 15px rgba(255, 121, 198, 0.1);
}

.theme-dracula .theme-dropdown {
  background-color: rgba(15, 15, 15, 0.95);
  border-color: rgba(255, 51, 51, 0.3);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8), 0 0 15px rgba(255, 51, 51, 0.2);
}

.theme-luxury .theme-dropdown {
  border-color: rgba(218, 165, 32, 0.3);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 15px rgba(218, 165, 32, 0.2);
}
</style>