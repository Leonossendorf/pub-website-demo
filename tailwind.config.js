/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./*.html', './assets/js/*.js'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Inter Display"', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      colors: {
        pub: { 950: '#120d0a', 900: '#1a1310', 800: '#241a15', 700: '#33251d', 600: '#4a362a' },
        gold: { 300: '#f3d68a', 400: '#e8bd5c', 500: '#d4a03a', 600: '#b8841f' },
        clover: { 500: '#2f8f5b', 600: '#1f6f45', 700: '#16543a' }
      }
    }
  },
  plugins: []
};
