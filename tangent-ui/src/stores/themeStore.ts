import { defineStore } from 'pinia';

// Theme type definitions
export type ThemeName =
  | "light" | "dark" | "cupcake" | "bumblebee" | "emerald" | "corporate"
  | "synthwave" | "retro" | "cyberpunk" | "valentine" | "halloween" | "garden"
  | "forest" | "aqua" | "lofi" | "pastel" | "fantasy" | "wireframe" | "black"
  | "luxury" | "neon" | "dracula" | "cmyk" | "autumn" | "business" | "acid" | "lemonade"
  | "night" | "coffee" | "winter";

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
}

interface ThemeState {
  currentTheme: ThemeName;
  availableThemes: ThemeName[];
  themeColors: Record<ThemeName, ThemeColors>;
}

export const useThemeStore = defineStore('theme', {
  state: (): ThemeState => ({
    currentTheme: (localStorage.getItem('theme') as ThemeName) || 'light',
    availableThemes: [
      "light", "dark", "cupcake", "bumblebee", "emerald", "corporate",
      "synthwave", "retro", "cyberpunk", "valentine", "halloween",
      "garden", "forest", "aqua", "lofi", "pastel", "fantasy",
      "wireframe", "black", "luxury", "neon", "dracula", "cmyk", "autumn",
      "business", "acid", "lemonade", "night", "coffee", "winter"
    ],
    themeColors: {
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
      synthwave: { primary: '#FF00FF', secondary: '#00FFFF', accent: '#CCCC00' },
      retro: { primary: '#D2691E', secondary: '#CD853F', accent: '#F4A460' },
      cyberpunk: { primary: '#00CCDD', secondary: '#FF1493', accent: '#88CC22' },
      valentine: { primary: '#FF69B4', secondary: '#DC143C', accent: '#FFB6C1' },
      halloween: { primary: '#7C3AED', secondary: '#581C87', accent: '#3B82F6' },
      forest: { primary: '#1EB854', secondary: '#1DB88E', accent: '#1EA885' },
      aqua: { primary: '#09ECF3', secondary: '#0771DE', accent: '#07ABE3' },
      black: { primary: '#333333', secondary: '#666666', accent: '#999999' },
      luxury: { primary: '#DAA520', secondary: '#B8860B', accent: '#FFD700' },
      neon: { primary: '#FF79C6', secondary: '#BD93F9', accent: '#50FA7B' },
      dracula: { primary: '#FF3333', secondary: '#FFFFFF', accent: '#FF3333' },
      cmyk: { primary: '#00BCD4', secondary: '#FF4081', accent: '#FFEB3B' },
      autumn: { primary: '#8B4513', secondary: '#A0522D', accent: '#CD853F' },
      business: { primary: '#1E3A8A', secondary: '#3B82F6', accent: '#60A5FA' },
      acid: { primary: '#FF00FF', secondary: '#00FF00', accent: '#CCCC00' },
      night: { primary: '#38BDF8', secondary: '#818CF8', accent: '#C084FC' },
      coffee: { primary: '#6F4E37', secondary: '#C6A880', accent: '#DAC3B3' },
      winter: { primary: '#0EA5E9', secondary: '#84CC16', accent: '#10B981' }
    }
  }),

  getters: {
    /**
     * Get the colors for the current theme
     */
    currentThemeColors: (state): ThemeColors => {
      return state.themeColors[state.currentTheme];
    },

    /**
     * Get the colors for a specific theme
     */
    getThemeColors: (state) => (theme: ThemeName): ThemeColors => {
      return state.themeColors[theme];
    },

    /**
     * Get filtered themes based on search term
     */
    filterThemes: (state) => (searchTerm: string): ThemeName[] => {
      return state.availableThemes.filter(theme =>
        theme.toLowerCase().includes(searchTerm.toLowerCase())
      );
    },

    /**
     * Check if a theme is a dark theme
     */
    isDarkTheme: (state) => (theme: ThemeName): boolean => {
      const darkThemes = ['dark', 'synthwave', 'cyberpunk', 'valentine', 
        'halloween', 'forest', 'aqua', 'black', 'luxury', 'neon', 'dracula', 
        'business', 'acid', 'night', 'coffee'];
      return darkThemes.includes(theme);
    }
  },

  actions: {
    /**
     * Set the current theme
     */
    setTheme(theme: ThemeName) {
      if (!this.availableThemes.includes(theme)) {
        console.warn(`Theme "${theme}" is not available`);
        return;
      }
      
      this.currentTheme = theme;
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('theme', theme);
    },

    /**
     * Initialize theme from localStorage or system preference
     */
    initializeTheme() {
      const savedTheme = localStorage.getItem('theme') as ThemeName;
      if (savedTheme && this.availableThemes.includes(savedTheme)) {
        this.setTheme(savedTheme);
      } else {
        // Default to system preference if no saved theme
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        this.setTheme(prefersDark ? 'dark' : 'light');
      }
    },

    /**
     * Toggle between light and dark mode
     */
    toggleDarkMode() {
      const isDark = this.isDarkTheme(this.currentTheme);
      this.setTheme(isDark ? 'light' : 'dark');
    }
  }
});