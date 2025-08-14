/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'cute-pink': '#FFB6C1',
        'cute-blue': '#87CEEB',
        'cute-yellow': '#FFD700',
        'cute-green': '#98FB98',
        'cute-purple': '#DDA0DD',
      },
      fontFamily: {
        'cute': ['Comic Sans MS', 'cursive'],
      },
      animation: {
        'bounce-gentle': 'bounce-gentle 2s infinite',
        'wiggle': 'wiggle 1s ease-in-out infinite',
      },
      keyframes: {
        'bounce-gentle': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'wiggle': {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
      },
    },
  },
  plugins: [],
}
