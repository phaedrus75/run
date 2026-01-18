/**
 * 🎨 COLOR THEME
 * ==============
 * 
 * A vibrant, energetic color palette for a running app!
 * 
 * 🎓 LEARNING NOTES:
 * - Using a consistent color system makes your app look professional
 * - CSS variables (in web) or constant objects (in React Native) help maintain consistency
 * - We export these so any component can use them
 */

export const colors = {
  // 🌈 Primary - Energetic Coral/Salmon
  primary: '#FF6B6B',
  primaryLight: '#FF8E8E',
  primaryDark: '#E85555',
  
  // 🌟 Secondary - Fresh Teal
  secondary: '#4ECDC4',
  secondaryLight: '#7EDDD6',
  secondaryDark: '#3DBDB5',
  
  // 🎯 Accent - Sunny Yellow
  accent: '#FFE66D',
  accentDark: '#FFD93D',
  
  // 🌙 Background tones
  background: '#FFF9F5',      // Warm off-white
  surface: '#FFFFFF',
  surfaceAlt: '#FFF5F0',
  
  // 📝 Text colors
  text: '#2D3436',
  textSecondary: '#636E72',
  textLight: '#B2BEC3',
  textOnPrimary: '#FFFFFF',
  
  // 🎨 Status colors
  success: '#00B894',
  warning: '#FDCB6E',
  error: '#E17055',
  
  // 🏃 Run type colors
  runTypes: {
    '3k': '#FF6B6B',   // Coral
    '5k': '#4ECDC4',   // Teal
    '10k': '#A29BFE',  // Purple
    '15k': '#FDCB6E',  // Yellow
    '18k': '#FF7F50',  // Coral Orange
    '21k': '#1A1A1A',  // Deep Black (Half Marathon)
  } as Record<string, string>,
  
  // 🌊 Gradients (for LinearGradient)
  gradients: {
    primary: ['#FF6B6B', '#FF8E8E'],
    secondary: ['#4ECDC4', '#7EDDD6'],
    sunset: ['#FF6B6B', '#FFE66D'],
    ocean: ['#4ECDC4', '#A29BFE'],
    fire: ['#FF6B6B', '#E17055'],
  },
};

// 🎭 Shadows for elevation
export const shadows = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
};

// 📐 Spacing scale
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// 🔤 Typography
export const typography = {
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
    hero: 48,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};

// 🔘 Border radius
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};
