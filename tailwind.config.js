/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './lib/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: '#e94560',
        dark: {
          900: '#0f0f1a',
          800: '#1a1a2e',
          700: '#16213e',
        },
      },
      fontFamily: {
        sans: ['Pretendard', 'Apple SD Gothic Neo', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
