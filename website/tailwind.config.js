/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        coral: {
          DEFAULT: '#E8756F',
          light: '#F09A95',
          dark: '#D0615B',
        },
        teal: {
          DEFAULT: '#4ECDC4',
          light: '#7EDDD6',
          dark: '#3DBDB5',
        },
        warm: {
          bg: '#FFF9F5',
          surface: '#FFF5F0',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
