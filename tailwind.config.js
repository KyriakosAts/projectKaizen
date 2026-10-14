import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const glob = (p) => join(__dirname, p).replace(/\\/g, '/')

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    glob('index.html'),
    glob('src/main.jsx'),
    glob('src/app/**/*.{js,jsx}'),
    glob('src/data/**/*.{js,jsx}'),
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        paper: '#f5f4f0',   // page background
        ink: '#1c1917',     // text + navigation rail
      },
      boxShadow: {
        card: '0 1px 2px rgb(28 25 23 / 0.06), 0 1px 1px rgb(28 25 23 / 0.04)',
        sheet: '0 -8px 30px rgb(28 25 23 / 0.18)',
      },
    },
  },
  plugins: [],
}
