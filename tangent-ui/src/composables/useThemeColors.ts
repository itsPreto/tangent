import { computed, Ref } from 'vue';
import { useThemeStore } from '@/stores/themeStore';
import { 
  generateColorSet, 
  getThemeBackgroundColors, 
  shouldForceLightText,
  adjustColorOpacity,
  adjustColorLightness,
  generateGradient,
  type ColorSet 
} from '@/utils/themeUtils';

/**
 * Composable for accessing theme colors and utilities in components
 * Provides reactive theme colors and helper functions
 */
export function useThemeColors() {
  const themeStore = useThemeStore();
  
  // Current theme and colors
  const currentTheme = computed(() => themeStore.currentTheme);
  const themeColors = computed(() => themeStore.currentThemeColors);
  const isDarkTheme = computed(() => themeStore.isDarkTheme(themeStore.currentTheme));
  const isLightTheme = computed(() => !isDarkTheme.value);
  
  // Force light text for specific themes
  const forceLightText = computed(() => shouldForceLightText(currentTheme.value));
  
  /**
   * Generate a color set for a given color index (0-2)
   * Used for node coloring and other indexed color needs
   * Returns a computed that is reactive to theme changes
   */
  const getIndexedColorSet = (index: number | string) => computed((): ColorSet => {
    const colorIndex = Math.abs(Number(index)) % 3;
    const colors = themeColors.value;
    
    let baseColor: string;
    switch (colorIndex) {
      case 0:
        baseColor = colors.primary;
        break;
      case 1:
        baseColor = colors.secondary;
        break;
      case 2:
        baseColor = colors.accent;
        break;
      default:
        baseColor = colors.primary;
    }
    
    return generateColorSet(baseColor, isDarkTheme.value);
  });
  
  /**
   * Get theme-aware background colors
   */
  const backgroundColors = computed(() => 
    getThemeBackgroundColors(
      themeColors.value.primary, 
      themeColors.value.secondary, 
      isDarkTheme.value
    )
  );
  
  /**
   * Get text color based on theme and background
   */
  const getTextColor = (backgroundColor?: string): string => {
    if (forceLightText.value) {
      return 'rgba(255, 255, 255, 0.95)';
    }
    
    if (backgroundColor) {
      const colorSet = generateColorSet(backgroundColor, isDarkTheme.value);
      return colorSet.contrastText;
    }
    
    return isDarkTheme.value ? 'rgba(255, 255, 255, 0.95)' : 'rgba(0, 0, 0, 0.87)';
  };
  
  /**
   * Common style objects for reuse
   */
  const commonStyles = {
    // Header styles
    header: computed(() => ({
      backgroundColor: isDarkTheme.value ? 'rgba(30, 30, 35, 0.95)' : 'rgba(250, 250, 255, 0.95)',
      borderColor: isDarkTheme.value ? 'rgba(80, 80, 90, 0.3)' : 'rgba(230, 230, 240, 0.5)',
      borderBottomWidth: '1px',
      borderBottomStyle: 'solid',
    })),
    
    // Control button styles
    controlButton: computed(() => ({
      backgroundColor: isDarkTheme.value ? 'rgba(40, 40, 50, 0.4)' : 'rgba(245, 245, 250, 0.6)',
      color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)',
      borderColor: isDarkTheme.value ? 'rgba(80, 80, 90, 0.2)' : 'rgba(230, 230, 240, 0.4)'
    })),
    
    // Action button styles (primary colored)
    actionButton: computed(() => {
      const primaryColor = themeColors.value.primary;
      return {
        backgroundColor: isDarkTheme.value
          ? adjustColorOpacity(primaryColor, 0.2)
          : adjustColorOpacity(primaryColor, 0.1),
        color: themeColors.value.primary,
        borderColor: adjustColorOpacity(primaryColor, 0.3)
      };
    }),
    
    // Error button styles
    errorButton: computed(() => {
      const errorColor = getComputedStyle(document.documentElement).getPropertyValue('--er') || '#FF3333';
      return {
        backgroundColor: isDarkTheme.value
          ? adjustColorOpacity(errorColor, 0.2)
          : adjustColorOpacity(errorColor, 0.1),
        color: errorColor,
        borderColor: adjustColorOpacity(errorColor, 0.3)
      };
    })
  };
  
  /**
   * Generate gradient backgrounds
   */
  const gradients = {
    primary: computed(() => 
      generateGradient([
        themeColors.value.primary,
        adjustColorLightness(themeColors.value.primary, -10)
      ])
    ),
    
    primaryToAccent: computed(() =>
      generateGradient([
        themeColors.value.primary,
        themeColors.value.accent
      ])
    ),
    
    subtle: computed(() =>
      generateGradient([
        adjustColorOpacity(themeColors.value.primary, 0.05),
        adjustColorOpacity(themeColors.value.accent, 0.02)
      ], 135)
    )
  };
  
  return {
    // Theme state
    currentTheme,
    themeColors,
    isDarkTheme,
    isLightTheme,
    forceLightText,
    
    // Color functions
    getIndexedColorSet,
    getTextColor,
    
    // Computed styles
    backgroundColors,
    commonStyles,
    gradients,
    
    // Re-export utility functions for convenience
    adjustColorOpacity,
    adjustColorLightness,
    generateColorSet,
    generateGradient
  };
}