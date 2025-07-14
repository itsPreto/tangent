<template>
  <div class="themes-feature" :class="'theme-' + currentTheme">
    <div class="themes-content">
      <!-- Themes Header -->
      <div class="themes-header" :style="headerStyle">
        <div class="header-section">
          <Palette class="w-5 h-5 text-pink-400" />
          <span class="header-text">Themes</span>
        </div>
        <div class="header-controls">
          <button @click="resetToDefault" class="control-btn" :style="buttonStyle">
            <RotateCcw class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Current Theme Info -->
      <div class="current-theme" :style="sectionStyle">
        <div class="theme-preview" :style="getCurrentThemePreviewStyle()">
          <div class="preview-content">
            <div class="preview-circle primary"></div>
            <div class="preview-circle secondary"></div>
            <div class="preview-circle accent"></div>
          </div>
        </div>
        <div class="theme-info">
          <h3 class="theme-name">{{ getCurrentThemeName() }}</h3>
          <p class="theme-description">{{ getCurrentThemeDescription() }}</p>
        </div>
      </div>

      <!-- Theme Categories -->
      <div class="theme-categories" :style="sectionStyle">
        <div class="category-tabs">
          <button 
            v-for="category in categories"
            :key="category.id"
            @click="activeCategory = category.id"
            class="category-tab"
            :class="{ 'active': activeCategory === category.id }"
            :style="getCategoryTabStyle(category.id === activeCategory)">
            {{ category.label }}
          </button>
        </div>
      </div>

      <!-- Theme Grid -->
      <div class="theme-grid-container">
        <div class="theme-grid">
          <div
            v-for="theme in filteredThemes"
            :key="theme.id"
            class="theme-card"
            :class="{ 'active': currentTheme === theme.id }"
            :style="getThemeCardStyle(theme)"
            @click="selectTheme(theme.id)">
            
            <div class="theme-preview-mini" :style="getThemePreviewStyle(theme)">
              <div class="preview-dots">
                <div class="dot primary" :style="{ backgroundColor: theme.colors.primary }"></div>
                <div class="dot secondary" :style="{ backgroundColor: theme.colors.secondary }"></div>
                <div class="dot accent" :style="{ backgroundColor: theme.colors.accent }"></div>
              </div>
            </div>
            
            <div class="theme-card-content">
              <h4 class="theme-card-name">{{ theme.name }}</h4>
              <p class="theme-card-type">{{ theme.type }}</p>
            </div>
            
            <div class="theme-card-overlay" v-if="currentTheme === theme.id">
              <Check class="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Palette, RotateCcw, Check } from 'lucide-vue-next';
import { useThemeStore } from '@/stores/themeStore';
import { useThemeColors } from '@/composables/useThemeColors';

// Stores
const themeStore = useThemeStore();

// Theme composable
const {
  currentTheme: currentThemeRef,
  isDarkTheme: isDarkThemeRef,
  themeColors: themeColorsRef,
  getTextColor
} = useThemeColors();

// Reactive state
const activeCategory = ref('all');

// Theme categories
const categories = [
  { id: 'all', label: 'All' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'colorful', label: 'Colorful' },
];

// Mock theme data - would come from theme store
const allThemes = [
  {
    id: 'light',
    name: 'Light',
    type: 'Light Theme',
    category: 'light',
    colors: { primary: '#3b82f6', secondary: '#10b981', accent: '#f59e0b' }
  },
  {
    id: 'dark',
    name: 'Dark',
    type: 'Dark Theme',
    category: 'dark',
    colors: { primary: '#60a5fa', secondary: '#34d399', accent: '#fbbf24' }
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    type: 'Dark Theme',
    category: 'colorful',
    colors: { primary: '#ff007f', secondary: '#00ffff', accent: '#ffff00' }
  },
  {
    id: 'synthwave',
    name: 'Synthwave',
    type: 'Dark Theme',
    category: 'colorful',
    colors: { primary: '#ff006e', secondary: '#8338ec', accent: '#ffbe0b' }
  },
  {
    id: 'cupcake',
    name: 'Cupcake',
    type: 'Light Theme',
    category: 'light',
    colors: { primary: '#65c3c8', secondary: '#ef9fbc', accent: '#eeaf3a' }
  },
  {
    id: 'forest',
    name: 'Forest',
    type: 'Dark Theme',
    category: 'dark',
    colors: { primary: '#1eb854', secondary: '#1fd65f', accent: '#b91c1c' }
  },
  {
    id: 'aqua',
    name: 'Aqua',
    type: 'Dark Theme',
    category: 'colorful',
    colors: { primary: '#00b4d8', secondary: '#0096c7', accent: '#023e8a' }
  },
  {
    id: 'valentine',
    name: 'Valentine',
    type: 'Light Theme',
    category: 'colorful',
    colors: { primary: '#e879f9', secondary: '#f472b6', accent: '#fb7185' }
  }
];

// Theme reactivity
const currentTheme = computed(() => themeStore.currentTheme);
const isDarkTheme = computed(() => themeStore.isDarkTheme(currentTheme.value));
const themeColors = computed(() => themeStore.getThemeColors(currentTheme.value));

// Computed
const filteredThemes = computed(() => {
  if (activeCategory.value === 'all') {
    return allThemes;
  }
  return allThemes.filter(theme => theme.category === activeCategory.value);
});

// Methods
const selectTheme = (themeId: string) => {
  themeStore.setTheme(themeId);
};

const resetToDefault = () => {
  themeStore.setTheme('dark');
};

const getCurrentThemeName = () => {
  const theme = allThemes.find(t => t.id === currentTheme.value);
  return theme?.name || 'Unknown';
};

const getCurrentThemeDescription = () => {
  const theme = allThemes.find(t => t.id === currentTheme.value);
  return theme?.type || 'Custom Theme';
};

// Computed styles
const headerStyle = computed(() => {
  return {
    borderBottom: `1px solid ${isDarkTheme.value ? 'rgba(80, 80, 80, 0.3)' : 'rgba(200, 200, 200, 0.3)'}`,
    backgroundColor: isDarkTheme.value ? 'rgba(20, 20, 20, 0.5)' : 'rgba(240, 240, 240, 0.5)',
    color: getTextColor()
  };
});

const sectionStyle = computed(() => {
  return {
    borderBottom: `1px solid ${isDarkTheme.value ? 'rgba(80, 80, 80, 0.2)' : 'rgba(200, 200, 200, 0.2)'}`,
    color: getTextColor()
  };
});

const buttonStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(40, 40, 40, 0.8)' : 'rgba(240, 240, 240, 0.8)',
    color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
    border: `1px solid ${isDarkTheme.value ? 'rgba(80, 80, 80, 0.3)' : 'rgba(200, 200, 200, 0.3)'}`
  };
});

const getCurrentThemePreviewStyle = () => {
  return {
    background: `linear-gradient(135deg, ${themeColors.value.primary}40, ${themeColors.value.secondary}40)`,
    border: `2px solid ${themeColors.value.primary}60`
  };
};

const getCategoryTabStyle = (isActive: boolean) => {
  return {
    backgroundColor: isActive ? themeColors.value.primary : 'transparent',
    color: isActive ? 'white' : (isDarkTheme.value ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)'),
    borderColor: isActive ? themeColors.value.primary : (isDarkTheme.value ? 'rgba(80, 80, 80, 0.3)' : 'rgba(200, 200, 200, 0.3)')
  };
};

const getThemeCardStyle = (theme: any) => {
  const isActive = currentTheme.value === theme.id;
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(30, 30, 30, 0.8)' : 'rgba(255, 255, 255, 0.8)',
    borderColor: isActive ? theme.colors.primary : (isDarkTheme.value ? 'rgba(80, 80, 80, 0.3)' : 'rgba(200, 200, 200, 0.3)'),
    borderWidth: isActive ? '2px' : '1px',
    color: getTextColor()
  };
};

const getThemePreviewStyle = (theme: any) => {
  return {
    background: `linear-gradient(135deg, ${theme.colors.primary}20, ${theme.colors.secondary}20)`,
    border: `1px solid ${theme.colors.primary}40`
  };
};
</script>

<style scoped>
.themes-feature {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.themes-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.themes-header {
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.header-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-text {
  font-weight: 600;
  font-size: 16px;
}

.header-controls {
  display: flex;
  gap: 8px;
}

.control-btn {
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.control-btn:hover {
  opacity: 0.8;
}

.current-theme {
  padding: 16px;
  display: flex;
  gap: 16px;
  align-items: center;
  flex-shrink: 0;
}

.theme-preview {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.preview-content {
  display: flex;
  gap: 4px;
}

.preview-circle {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.preview-circle.primary {
  background: currentColor;
}

.preview-circle.secondary {
  background: var(--secondary, #10b981);
}

.preview-circle.accent {
  background: var(--accent, #f59e0b);
}

.theme-info {
  flex: 1;
}

.theme-name {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 4px;
}

.theme-description {
  font-size: 14px;
  opacity: 0.7;
  margin: 0;
}

.theme-categories {
  padding: 16px;
  flex-shrink: 0;
}

.category-tabs {
  display: flex;
  gap: 8px;
}

.category-tab {
  padding: 8px 16px;
  border: 1px solid;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.category-tab:hover {
  opacity: 0.8;
}

.theme-grid-container {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px 16px;
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}

.theme-card {
  border: 1px solid;
  border-radius: 12px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.theme-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

.theme-card.active {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
}

.theme-preview-mini {
  width: 100%;
  height: 60px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}

.preview-dots {
  display: flex;
  gap: 6px;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.theme-card-content {
  text-align: center;
}

.theme-card-name {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 4px;
}

.theme-card-type {
  font-size: 12px;
  opacity: 0.6;
  margin: 0;
}

.theme-card-overlay {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

/* Theme-specific text contrast overrides */
.theme-light,
.theme-cupcake,
.theme-bumblebee,
.theme-emerald,
.theme-corporate,
.theme-retro,
.theme-valentine,
.theme-garden,
.theme-pastel,
.theme-wireframe,
.theme-cmyk,
.theme-lemonade,
.theme-winter,
.theme-lofi,
.theme-fantasy,
.theme-autumn {
  .header-text,
  .theme-name,
  .theme-card-name {
    color: rgba(0, 0, 0, 0.9) !important;
    font-weight: 600;
  }
  
  .theme-description,
  .theme-card-type {
    color: rgba(0, 0, 0, 0.6) !important;
  }
  
  .category-tab {
    color: rgba(0, 0, 0, 0.7) !important;
  }
  
  .category-tab.active {
    color: white !important;
  }
}

.theme-dark,
.theme-synthwave,
.theme-cyberpunk,
.theme-halloween,
.theme-forest,
.theme-aqua,
.theme-black,
.theme-luxury,
.theme-neon,
.theme-dracula,
.theme-business,
.theme-acid,
.theme-night,
.theme-coffee {
  .header-text,
  .theme-name,
  .theme-card-name {
    color: rgba(255, 255, 255, 0.95) !important;
  }
  
  .theme-description,
  .theme-card-type {
    color: rgba(255, 255, 255, 0.6) !important;
  }
  
  .category-tab {
    color: rgba(255, 255, 255, 0.7) !important;
  }
}
</style>