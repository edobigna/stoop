/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'stoop-green': '#50C878',
        'stoop-green-light': '#A2D5AB',
        'stoop-green-dark': '#3A912D',
        'stoop-green-darker': '#2E7D32',
        'stoop-light': '#F0FFF0',
      }
    },
  },
  plugins: [],
}
