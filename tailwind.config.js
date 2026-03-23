import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import colors from 'tailwindcss/colors'

const __dirname = dirname(fileURLToPath(import.meta.url))
const glob = (p) => join(__dirname, p).replace(/\\/g, '/')

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    glob('index.html'),
    glob('src/**/*.{js,jsx}'),
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      colors: {
        // Primary color uses CSS variables — supports dynamic accent switching
        // AND opacity modifiers (bg-primary-500/20) via <alpha-value> placeholder
        primary: {
          50:  'rgb(var(--primary-50)  / <alpha-value>)',
          100: 'rgb(var(--primary-100) / <alpha-value>)',
          400: 'rgb(var(--primary-400) / <alpha-value>)',
          500: 'rgb(var(--primary-500) / <alpha-value>)',
          600: 'rgb(var(--primary-600) / <alpha-value>)',
          700: 'rgb(var(--primary-700) / <alpha-value>)',
        },
        sidebar: '#0d1117',
      },
      backgroundImage: {
        'sidebar-gradient': 'linear-gradient(180deg, #0d1117 0%, #131920 100%)',
      },
    },
  },
  plugins: [],
}
