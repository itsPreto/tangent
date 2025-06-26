<template>
  <div
    class="relative inline-block theme-logo-container"
    :class="'theme-' + currentTheme"
  >
    <!-- Logo Section -->

    <!-- Theme Label or Palette Indicator -->
    <div 
      class="flex items-center justify-center gap-1 mt-2 relative overflow-hidden"
    >
      <div class="cursor-pointer relative" 
           @click="toggleDropdown"
           @mouseenter="handleDotsMouseEnter"
           @mouseleave="handleDotsMouseLeave">
        
        <!-- Dots and Letters Container -->
        <div class="flex items-center justify-center relative min-w-[60px] min-h-[20px]">
          <!-- Dots -->
          <div 
            v-for="(color, index) in paletteColors" 
            :key="`dot-${index}`"
            ref="dotsRefs"
            class="w-2 h-2 rounded-full transition-all duration-300 hover:scale-125 dot-element absolute"
            :style="{ 
              backgroundColor: color, 
              boxShadow: `0 1px 2px ${isDarkTheme ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.2)'}`,
              left: `calc(50% + ${(index - 1) * 12}px - 4px)`,
              top: '50%',
              transform: showDotsState 
                ? 'translateY(-50%) scale(1)' 
                : 'translateY(-70%) scale(0.5)',
              opacity: showDotsState ? 1 : 0,
              transitionDelay: showDotsState ? `${(2 - index) * 50}ms` : `${index * 50}ms`
            }"
          />
          
          <!-- Theme Label Letters -->
          <div 
            class="flex items-center justify-center absolute inset-0"
            :style="{
              opacity: showDotsState ? 0 : 1,
              transform: showDotsState ? 'translateY(20px)' : 'translateY(0px)'
            }"
          >
            <span
              v-for="(letter, index) in themeLetters"
              :key="`letter-${index}`"
              ref="lettersRefs"
              class="text-sm font-medium letter-element"
              :style="{
                background: `linear-gradient(135deg, ${getThemeColors(currentTheme).primary}, ${getThemeColors(currentTheme).secondary}, ${getThemeColors(currentTheme).accent})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                transitionDelay: showDotsState ? `${index * 50}ms` : `${(themeLetters.length - 1 - index) * 50}ms`,
                opacity: showDotsState ? 0 : 1,
                transform: showDotsState ? 'translateY(20px) scale(0.8)' : 'translateY(0px) scale(1)'
              }"
            >
              {{ letter }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Theme Dropdown (visible when clicked) -->
    <Teleport to="body">
      <div 
        v-if="isDropdownOpen"
        class="fixed w-64 max-h-[60vh] overflow-y-auto rounded-lg border shadow-lg theme-dropdown transition-all duration-200"
        style="z-index: 99999;"
        :style="{ ...dropdownStyle, ...getDropdownPosition() }"
        @click.stop
      >
      <div class="p-2 search-container" :style="searchContainerStyle">
        <div class="relative">
          <Search class="absolute left-3 top-2.5 w-4 h-4 search-icon" :style="{ color: searchIconColor }" />
          <input 
            v-model="search" 
            type="text" 
            placeholder="Search themes..."
            class="w-full px-3 py-2 pl-9 text-sm rounded-md border-0 focus:ring-1 focus:outline-none search-input"
            :style="searchInputStyle" 
          />
        </div>
      </div>

      <div class="py-1 themes-list">
        <button 
          v-for="theme in filteredThemes" 
          :key="theme" 
          @click="selectTheme(theme)"
          class="w-full px-3 py-2 flex items-center gap-3 transition-colors group theme-option"
          :class="{ 'selected-theme': theme === currentTheme }"
          :style="getThemeOptionStyle(theme)"
        >
          <!-- Theme Preview -->
          <div class="flex items-center gap-1.5">
            <div 
              class="w-3 h-3 rounded-full transition-transform group-hover:scale-110 duration-200 theme-preview-dot"
              :style="{ backgroundColor: getThemeColors(theme).primary }" 
            />
            <div 
              class="w-3 h-3 rounded-full transition-transform group-hover:scale-110 duration-200 theme-preview-dot"
              :style="{ backgroundColor: getThemeColors(theme).secondary }" 
            />
            <div 
              class="w-3 h-3 rounded-full transition-transform group-hover:scale-110 duration-200 theme-preview-dot"
              :style="{ backgroundColor: getThemeColors(theme).accent }" 
            />
          </div>

          <span class="text-sm theme-option-name">{{ theme.charAt(0).toUpperCase() + theme.slice(1) }}</span>

          <Check v-if="theme === currentTheme" class="w-4 h-4 ml-auto text-primary" />
        </button>
      </div>
      </div>
    </Teleport>
    <div
      class="w-[180px] h-[36px] relative perspective-[1000px] rounded-lg overflow-hidden mt-2 cursor-pointer logo-container"
      @mousemove="handleMouseMove"
      @mouseleave="handleLogoMouseLeave"
    >
      <!-- Left click area -->
      <div 
        class="absolute left-0 top-0 w-1/2 h-full z-10 hover-area-left"
        @click="previousTheme"
        :style="leftHoverStyle"
      ></div>
      <!-- Right click area -->
      <div 
        class="absolute right-0 top-0 w-1/2 h-full z-10 hover-area-right"
        @click="nextTheme"
        :style="rightHoverStyle"
      ></div>
      <div
        ref="gridRef"
        class="w-full h-full grid relative gap-0"
        :style="{
          gridTemplateColumns: `repeat(${COLS}, 1fr)`,
          gridTemplateRows: `repeat(${ROWS}, 1fr)`
        }"
      >
        <div
          v-for="(_, i) in cells"
          :key="i"
          class="relative transition-transform duration-1000 ease-in-out cell"
          :style="{
            transformStyle: 'preserve-3d',
            border: 'none',
            backgroundColor: 'transparent'
          }"
        >
          <div
            class="absolute w-full h-full overflow-hidden front"
            :style="{
              backfaceVisibility: 'hidden',
              backgroundColor: 'transparent'
            }"
          >
            <div
              class="w-[180px] h-[36px] relative"
              :style="{
                transform: `translate(${-(i % COLS) * (180 / COLS)}px, ${-Math.floor(i / COLS) * (36 / ROWS)}px)`
              }"
            >
              <LogoSVG />
            </div>
          </div>
          <div
            class="absolute w-full h-full overflow-hidden back"
            :style="{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              backgroundColor: 'transparent'
            }"
          >
            <div
              class="absolute w-[180px] h-[36px]"
              :style="{
                transform: `translate(${-(i % COLS) * (180 / COLS)}px, ${-Math.floor(i / COLS) * (36 / ROWS)}px)`
              }"
            >
              <div 
                class="font-sans text-[24px] font-bold w-full h-full flex items-center justify-center"
                :style="{
                  background: `linear-gradient(135deg, ${getThemeColors(currentTheme).primary}, ${getThemeColors(currentTheme).secondary}, ${getThemeColors(currentTheme).accent})`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }"
              >
                TANGENT
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { Check, Search } from 'lucide-vue-next';
import LogoSVG from './LogoSVG.vue';

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

// Logo animation constants
const COLS = 15;
const ROWS = 5;
const cells = Array.from({ length: ROWS * COLS });

// Logo animation state
const isShowingFront = ref(true);
const gridRef = ref<HTMLDivElement | null>(null);
const isAnimating = ref(false);

// Theme toggle state
const isDropdownOpen = ref(false);
const search = ref('');
const currentTheme = ref<ThemeName>(
  (localStorage.getItem('theme') as ThemeName) || 'light'
);
const showThemeLabel = ref(false);
const isHoveringDots = ref(false);
const hoverSide = ref<'left' | 'right' | null>(null);

// Refs for animation
const dotsRefs = ref<HTMLDivElement[]>([]);
const lettersRefs = ref<HTMLSpanElement[]>([]);

// Computed for showing dots vs letters
const showDotsState = computed(() => {
  return !showThemeLabel.value && !isHoveringDots.value;
});

// Split theme name into letters
const themeLetters = computed(() => {
  const themeName = currentTheme.value.charAt(0).toUpperCase() + currentTheme.value.slice(1);
  return themeName.split('');
});

let labelTimeout: number | null = null;
let dotsHoverTimeout: number | null = null;

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

// Dark themes list
const darkThemes = [
  'dark', 'synthwave', 'retro', 'cyberpunk', 'halloween',
  'forest', 'aqua', 'black', 'luxury', 'dracula', 'cmyk',
  'autumn', 'business', 'acid', 'night', 'coffee'
];

// Theme observer for real-time updates
let themeObserver: MutationObserver | null = null;

// Check if current theme is dark
const isDarkTheme = computed(() => {
  return darkThemes.includes(currentTheme.value);
});

// Palette colors for indicator circles
const paletteColors = computed(() => {
  const colors = getThemeColors(currentTheme.value);
  return [colors.primary, colors.secondary, colors.accent];
});

// Dynamic styling
const dropdownStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(20, 20, 25, 0.95)' : 'rgba(250, 250, 255, 0.95)',
    borderColor: isDarkTheme.value ? 'rgba(70, 70, 80, 0.3)' : 'rgba(210, 210, 220, 0.5)',
    color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)',
    backdropFilter: 'blur(10px)',
    boxShadow: isDarkTheme.value 
      ? '0 8px 20px rgba(0, 0, 0, 0.4)' 
      : '0 8px 20px rgba(0, 0, 0, 0.1)',
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
    '--tw-ring-color': adjustColorOpacity(primaryColor, 0.4)
  };
});

const searchIconColor = computed(() => {
  return isDarkTheme.value ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.4)';
});

// Logo animation functions
const flipCell = (cell: HTMLElement, delay: number) => {
  setTimeout(() => {
    if (cell) {
      cell.style.transform = isShowingFront.value ? 'rotateY(180deg)' : 'rotateY(0deg)';
    }
  }, delay);
};

const animateFlip = () => {
  if (!gridRef.value) return;
  const cells = Array.from(gridRef.value.querySelectorAll('.cell'));

  // Start the indicator wave animation
  startIndicatorWave();

  const columns: HTMLElement[][] = Array.from({ length: COLS }, () => []);
  cells.forEach((cell, index) => {
    const col = index % COLS;
    columns[col].push(cell as HTMLElement);
  });

  const delayBetweenColumns = 50;
  const middle = Math.floor(COLS / 2);
  let columnOrder = [middle];
  
  for (let offset = 1; offset <= middle; offset++) {
    if (middle - offset >= 0) columnOrder.push(middle - offset);
    if (middle + offset < COLS) columnOrder.push(middle + offset);
  }

  if (!isShowingFront.value) {
    columnOrder = columnOrder.reverse();
  }

  columnOrder.forEach((colIndex, index) => {
    setTimeout(() => {
      columns[colIndex].forEach((cell) => {
        flipCell(cell, 0);
      });
    }, index * delayBetweenColumns);
  });

  setTimeout(() => {
    isShowingFront.value = !isShowingFront.value;
  }, columnOrder.length * delayBetweenColumns + 500);
};

const startIndicatorWave = () => {
  isAnimating.value = true;
  
  // Sequential wave animation for dots
  if (dotsRefs.value.length > 0) {
    dotsRefs.value.forEach((dot, index) => {
      if (dot) {
        // Each dot starts its animation after a delay
        const delay = index * 150; // 150ms between each dot
        setTimeout(() => {
          animateDot(dot);
        }, delay);
      }
    });
  }
  
  // For theme label letters, do a wave bounce
  if (!showDotsState.value) {
    animateLabel();
  }
  
  setTimeout(() => {
    isAnimating.value = false;
  }, 1200); // Total animation duration
};

const animateDot = (dot: HTMLDivElement) => {
  // Move up
  dot.style.transform = 'translateY(-8px)';
  dot.style.transition = 'transform 0.3s ease-out';
  
  // Move down
  setTimeout(() => {
    dot.style.transform = 'translateY(0px)';
    dot.style.transition = 'transform 0.3s ease-in';
  }, 300);
};

const animateLabel = () => {
  // Animate letters with wave effect
  if (lettersRefs.value.length > 0) {
    lettersRefs.value.forEach((letter, index) => {
      if (letter) {
        const delay = index * 50;
        setTimeout(() => {
          // Bounce effect
          letter.style.transform = 'translateY(-6px) scale(1.1)';
          letter.style.transition = 'transform 0.3s ease-out';
          
          setTimeout(() => {
            letter.style.transform = 'translateY(0px) scale(1)';
            letter.style.transition = 'transform 0.3s ease-in';
          }, 300);
        }, delay);
      }
    });
  }
};

const getDotWaveOffset = (index: number) => {
  // Not used anymore since we're doing direct DOM manipulation
  return 0;
};

const getLabelWaveOffset = () => {
  // Not used anymore since we're doing direct DOM manipulation
  return 0;
};

// Theme functions
function adjustColorOpacity(hexColor: string, opacity: number): string {
  let r, g, b;
  
  if (!/^#([A-Fa-f0-9]{3}){1,2}$/.test(hexColor)) {
    return `rgba(128, 128, 128, ${opacity})`;
  }
  
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

const getDropdownPosition = () => {
  if (typeof window === 'undefined') return {};
  
  const container = document.querySelector('.theme-logo-container');
  if (!container) return {};
  
  const rect = container.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const dropdownWidth = 256; // 16rem (w-64)
  
  let left = rect.left;
  if (left + dropdownWidth > viewportWidth - 16) {
    left = viewportWidth - dropdownWidth - 16;
  }
  
  return {
    top: `${rect.bottom + 8}px`,
    left: `${Math.max(16, left)}px`
  };
};

const filteredThemes = computed(() => {
  const searchTerm = search.value.toLowerCase();
  return themes.filter(theme =>
    theme.toLowerCase().includes(searchTerm)
  );
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
  };
};

const selectTheme = (theme: ThemeName) => {
  currentTheme.value = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  isDropdownOpen.value = false;
};

const nextTheme = () => {
  const currentIndex = themes.indexOf(currentTheme.value);
  const nextIndex = (currentIndex + 1) % themes.length;
  selectTheme(themes[nextIndex]);
  showThemeLabelBriefly();
};

const previousTheme = () => {
  const currentIndex = themes.indexOf(currentTheme.value);
  const prevIndex = currentIndex === 0 ? themes.length - 1 : currentIndex - 1;
  selectTheme(themes[prevIndex]);
  showThemeLabelBriefly();
};

const showThemeLabelBriefly = () => {
  showThemeLabel.value = true;
  if (labelTimeout) {
    clearTimeout(labelTimeout);
  }
  labelTimeout = window.setTimeout(() => {
    showThemeLabel.value = false;
  }, 3000);
};

const updateThemeFromDOM = () => {
  const newTheme = document.documentElement.getAttribute('data-theme') as ThemeName || 'light';
  if (newTheme !== currentTheme.value) {
    currentTheme.value = newTheme;
  }
};

const toggleDropdown = () => {
  isDropdownOpen.value = !isDropdownOpen.value;
};

const handleDotsMouseEnter = () => {
  if (dotsHoverTimeout) {
    clearTimeout(dotsHoverTimeout);
    dotsHoverTimeout = null;
  }
  isHoveringDots.value = true;
};

const handleDotsMouseLeave = () => {
  dotsHoverTimeout = window.setTimeout(() => {
    isHoveringDots.value = false;
  }, 100); // Faster response
};

const handleMouseMove = (event: MouseEvent) => {
  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const width = rect.width;
  
  hoverSide.value = x < width / 2 ? 'left' : 'right';
};

const handleLogoMouseLeave = () => {
  hoverSide.value = null;
};

const leftHoverStyle = computed(() => {
  const isHovering = hoverSide.value === 'left';
  return {
    background: isHovering 
      ? `linear-gradient(to right, ${adjustColorOpacity(getThemeColors(currentTheme.value).primary, 0.15)}, transparent)`
      : 'transparent',
    transition: 'background 0.2s ease',
  };
});

const rightHoverStyle = computed(() => {
  const isHovering = hoverSide.value === 'right';
  return {
    background: isHovering 
      ? `linear-gradient(to left, ${adjustColorOpacity(getThemeColors(currentTheme.value).secondary, 0.15)}, transparent)`
      : 'transparent',
    transition: 'background 0.2s ease',
  };
});

let intervalId: number;


// Close dropdown when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  if (isDropdownOpen.value && !target.closest('.theme-dropdown') && !target.closest('.theme-logo-container')) {
    isDropdownOpen.value = false;
  }
};

onMounted(() => {
  intervalId = window.setInterval(animateFlip, 5050);
  
  const savedTheme = localStorage.getItem('theme') as ThemeName || 'light';
  currentTheme.value = savedTheme;
  document.documentElement.setAttribute('data-theme', savedTheme);
  
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
  clearInterval(intervalId);
  if (themeObserver) {
    themeObserver.disconnect();
  }
  if (labelTimeout) {
    clearTimeout(labelTimeout);
  }
  if (dotsHoverTimeout) {
    clearTimeout(dotsHoverTimeout);
  }
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
.theme-logo-container {
  position: relative;
  z-index: 50;
  transform: translateY(2px); /* Adjust logo position slightly down */
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

/* Dot and letter wave animations */
.dot-element {
  will-change: transform, opacity;
  transition: all 0.3s ease;
}

.letter-element {
  will-change: transform, opacity;
  transition: all 0.3s ease;
  display: inline-block;
}

/* Staggered animation delays for letters */
.letter-element:nth-child(1) { transition-delay: 0ms; }
.letter-element:nth-child(2) { transition-delay: 50ms; }
.letter-element:nth-child(3) { transition-delay: 100ms; }
.letter-element:nth-child(4) { transition-delay: 150ms; }
.letter-element:nth-child(5) { transition-delay: 200ms; }
.letter-element:nth-child(6) { transition-delay: 250ms; }
.letter-element:nth-child(7) { transition-delay: 300ms; }
.letter-element:nth-child(8) { transition-delay: 350ms; }
.letter-element:nth-child(9) { transition-delay: 400ms; }
.letter-element:nth-child(10) { transition-delay: 450ms; }
</style>