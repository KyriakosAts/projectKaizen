import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/inter/800.css'

// Old Android WebViews (< Chromium 84) lack flex `gap` and render the layout
// collapsed. Show an update prompt instead of a broken app.
const chromeVersion = Number(navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] ?? 999)
if (/android/i.test(navigator.userAgent) && chromeVersion < 84) {
  document.getElementById('root').innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0e1a;color:#f0f0ff;font-family:sans-serif;text-align:center;padding:32px">
      <div>
        <p style="font-size:48px;margin:0 0 16px">🥋</p>
        <h1 style="font-size:22px;margin:0 0 12px">Χρειάζεται μια ενημέρωση πρώτα</h1>
        <p style="color:#8b93b8;max-width:420px;line-height:1.6;margin:0">
          Άνοιξε το <b style="color:#f0f0ff">Play Store</b>, αναζήτησε
          «<b style="color:#f0f0ff">Android System WebView</b>» και πάτα
          <b style="color:#f0f0ff">Ενημέρωση</b>. Μετά άνοιξε ξανά την εφαρμογή.
        </p>
      </div>
    </div>`
} else {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}
