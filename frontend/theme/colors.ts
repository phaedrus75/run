export const colors = {
  primary: '#C0816B',
  primaryLight: '#D4A08E',
  primaryDark: '#A66B55',
  
  secondary: '#7BAFA6',
  secondaryLight: '#9DC5BE',
  secondaryDark: '#5E9990',
  
  accent: '#E8D5A3',
  accentDark: '#D4BF85',
  
  background: '#FAF7F2',
  surface: '#FFFFFF',
  surfaceAlt: '#F5F0EA',
  
  text: '#3D3D3D',
  textSecondary: '#6B7280',
  textLight: '#A8B0B8',
  textOnPrimary: '#FFFFFF',
  
  border: '#E5E1DB',
  
  success: '#6BA386',
  warning: '#D4BF85',
  error: '#C97B6B',
  
  runTypes: {
    '1k': '#A8D8D0',
    '2k': '#8FB8D0',
    '3k': '#C0816B',
    '5k': '#7BAFA6',
    '8k': '#8B7EC7',
    '10k': '#A89BD0',
    '15k': '#D4BF85',
    '18k': '#C9907A',
    '21k': '#3D3D3D',
  } as Record<string, string>,
  
  gradients: {
    primary: ['#C0816B', '#D4A08E'],
    secondary: ['#7BAFA6', '#9DC5BE'],
    sunset: ['#C0816B', '#E8D5A3'],
    ocean: ['#7BAFA6', '#A89BD0'],
    warmth: ['#C0816B', '#C9907A'],
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
