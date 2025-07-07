/**
 * Centralized theme utilities for color manipulation and theme-aware calculations
 * This module consolidates all color manipulation functions previously scattered across components
 */

/**
 * Convert hex color to RGB object
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Handle 3-digit hex
  if (hex.length === 3) {
    hex = hex.split('').map(char => char + char).join('');
  }
  
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  return { r, g, b };
}

/**
 * Convert RGB to hex color
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.round(Math.max(0, Math.min(255, n))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  return '#' + toHex(r) + toHex(g) + toHex(b);
}

/**
 * Adjust color opacity
 * Returns rgba string with specified opacity
 */
export function adjustColorOpacity(color: string, opacity: number): string {
  const rgb = hexToRgb(color);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
}

/**
 * Adjust color lightness
 * Positive amount = lighter, negative amount = darker
 */
export function adjustColorLightness(color: string, amount: number): string {
  const rgb = hexToRgb(color);
  
  const adjust = (value: number) => {
    if (amount > 0) {
      // Lighten: move towards 255
      return Math.round(value + (255 - value) * (amount / 100));
    } else {
      // Darken: move towards 0
      return Math.round(value * (1 + amount / 100));
    }
  };
  
  return rgbToHex(adjust(rgb.r), adjust(rgb.g), adjust(rgb.b));
}

/**
 * Get contrast text color (black or white) based on background
 */
export function getContrastTextColor(backgroundColor: string): string {
  const rgb = hexToRgb(backgroundColor);
  
  // Calculate relative luminance
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  
  // Return black for light backgrounds, white for dark
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

/**
 * Get enhanced contrast text color with opacity support
 */
export function getContrastTextColorWithOpacity(backgroundColor: string, isDark: boolean): string {
  const baseContrast = getContrastTextColor(backgroundColor);
  return baseContrast === '#000000' 
    ? 'rgba(0, 0, 0, 0.87)' 
    : 'rgba(255, 255, 255, 0.95)';
}

/**
 * Generate a complete color set from a base color
 */
export interface ColorSet {
  base: string;
  light: string;
  dark: string;
  transparent: string;
  contrastText: string;
}

export function generateColorSet(baseColor: string, isDarkTheme: boolean): ColorSet {
  return {
    base: baseColor,
    light: adjustColorLightness(baseColor, 30),
    dark: adjustColorLightness(baseColor, -20),
    transparent: adjustColorOpacity(baseColor, 0.15),
    contrastText: getContrastTextColorWithOpacity(baseColor, isDarkTheme)
  };
}

/**
 * Create theme-aware background colors
 */
export function getThemeBackgroundColors(primaryColor: string, secondaryColor: string, isDarkTheme: boolean) {
  const primaryRgb = hexToRgb(primaryColor);
  const secondaryRgb = hexToRgb(secondaryColor);
  
  if (isDarkTheme) {
    // Dark themes: use very dark tints of theme colors
    return {
      base: `rgba(${Math.min(primaryRgb.r * 0.3, 40)}, ${Math.min(primaryRgb.g * 0.3, 40)}, ${Math.min(primaryRgb.b * 0.3, 40)}, 0.85)`,
      message: `rgba(${Math.min(secondaryRgb.r * 0.2, 30)}, ${Math.min(secondaryRgb.g * 0.2, 30)}, ${Math.min(secondaryRgb.b * 0.2, 30)}, 0.7)`
    };
  } else {
    // Light themes: use very light tints of theme colors
    return {
      base: `rgba(${Math.max(255 - (255 - primaryRgb.r) * 0.1, 240)}, ${Math.max(255 - (255 - primaryRgb.g) * 0.1, 240)}, ${Math.max(255 - (255 - primaryRgb.b) * 0.1, 240)}, 0.9)`,
      message: `rgba(${Math.max(255 - (255 - secondaryRgb.r) * 0.05, 245)}, ${Math.max(255 - (255 - secondaryRgb.g) * 0.05, 245)}, ${Math.max(255 - (255 - secondaryRgb.b) * 0.05, 245)}, 0.8)`
    };
  }
}

/**
 * Mix two colors at a given ratio
 */
export function mixColors(color1: string, color2: string, ratio: number = 0.5): string {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  
  const r = Math.round(rgb1.r * (1 - ratio) + rgb2.r * ratio);
  const g = Math.round(rgb1.g * (1 - ratio) + rgb2.g * ratio);
  const b = Math.round(rgb1.b * (1 - ratio) + rgb2.b * ratio);
  
  return rgbToHex(r, g, b);
}

/**
 * Generate a gradient string from theme colors
 */
export function generateGradient(colors: string[], angle: number = 135): string {
  const colorStops = colors.map((color, index) => {
    const position = (index / (colors.length - 1)) * 100;
    return `${color} ${position}%`;
  }).join(', ');
  
  return `linear-gradient(${angle}deg, ${colorStops})`;
}

/**
 * List of themes that should always use light text regardless of contrast calculation
 */
export const FORCE_LIGHT_TEXT_THEMES = [
  'dark', 'synthwave', 'retro', 'cyberpunk', 'halloween',
  'forest', 'aqua', 'black', 'luxury', 'dracula', 'cmyk',
  'autumn', 'business', 'acid', 'night', 'coffee'
];

/**
 * Check if a theme should force light text
 */
export function shouldForceLightText(themeName: string): boolean {
  return FORCE_LIGHT_TEXT_THEMES.includes(themeName);
}