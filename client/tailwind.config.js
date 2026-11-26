/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      screens: {
        xs: '400px'
      },
      colors: {
        navy: {
          950: '#060F24',
          900: '#0B1A38',
          800: '#132852',
          700: '#1E3A6E',
          100: '#EEF2F8',
          50: '#F7F9FC'
        },
        gold: {
          700: '#78512A',
          600: '#9A6B3B',
          500: '#B8844E',
          400: '#D4A876',
          300: '#E8C9A4'
        },
        biscuit: {
          100: '#E5CAA8',
          200: '#D4B087',
          300: '#C29768'
        }
      },
      fontFamily: {
        sans: ['"Outfit"', 'system-ui', 'sans-serif'],
        serif: ['"Cinzel"', 'Georgia', 'serif']
      }
    }
  },
  plugins: []
};
