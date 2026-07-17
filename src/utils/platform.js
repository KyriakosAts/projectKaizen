/**
 * Platform detection helpers.
 *
 * isAndroid  — feature-gates things the Android WebView cannot do
 *              (window.open printing, blob <a download>, free-text folder paths)
 * isCoarsePointer — touch-first UI adjustments (tap targets, hiding
 *              keyboard-shortcut settings)
 */

export const isAndroid = () =>
  typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent)

export const isCoarsePointer = () =>
  typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

/** Clipboard write that survives the Android WebView (navigator.clipboard is
 *  undefined there — http://tauri.localhost is not a secure context). */
export function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text)
      return true
    }
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}
