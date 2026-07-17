/**
 * Native confirm/alert dialogs.
 *
 * window.confirm / window.alert are silent no-ops in the Android WebView under
 * Tauri (confirm always returns false), which would leave restore/reset/delete
 * flows dead. The Tauri dialog plugin shows real native dialogs on every
 * platform; plain browser dev mode falls back to the window.* built-ins.
 */

import { isTauri } from '../services/dataService'

export async function confirmDialog(message, title = 'Dojo Patras') {
  if (!isTauri()) return window.confirm(message)
  const { ask } = await import('@tauri-apps/plugin-dialog')
  return ask(message, { title, kind: 'warning' })
}

export async function alertDialog(message, title = 'Dojo Patras') {
  if (!isTauri()) {
    window.alert(message)
    return
  }
  const { message: showMessage } = await import('@tauri-apps/plugin-dialog')
  await showMessage(message, { title })
}
