/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        addu: {
          blue: '#003366',
          gold: '#C4A035',
        },
      },
    },
  },
  plugins: [],
};
