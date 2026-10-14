/**
 * Storage backend. In the app (Tauri) every call goes to the native SQLite
 * document store; in a plain browser (`npm run dev`) the same API is backed
 * by localStorage so the UI can be developed and tested without a native build.
 */

export const isTauri = () =>
  typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined

async function invoke(cmd, args) {
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core')
  return tauriInvoke(cmd, args)
}

// ── Browser fallback ─────────────────────────────────────────────────────────

const LS_DOCS = 'dojo3_docs'
const LS_SETTINGS = 'dojo3_settings'

const lsRead = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback } catch { return fallback }
}
const lsWrite = (key, val) => localStorage.setItem(key, JSON.stringify(val))

const browser = {
  setup: async () => ({ dbPath: 'browser', dataFolder: '', backupFolder: '', created: false, warning: null }),
  getAppConfig: async () => ({ dbPath: 'browser', dataFolder: '', backupFolder: '', lastBackup: null }),
  setDataFolder: async () => browser.getAppConfig(),
  loadAll: async () => {
    const docs = lsRead(LS_DOCS, {})
    return Object.fromEntries(Object.entries(docs).map(([c, byId]) => [c, Object.values(byId)]))
  },
  apply: async (ops) => {
    const docs = lsRead(LS_DOCS, {})
    for (const op of ops) {
      docs[op.collection] ??= {}
      if (op.op === 'put') docs[op.collection][op.id] = op.data
      else delete docs[op.collection][op.id]
    }
    lsWrite(LS_DOCS, docs)
  },
  getSetting: async (key) => lsRead(LS_SETTINGS, {})[key] ?? null,
  setSetting: async (key, value) => {
    const s = lsRead(LS_SETTINGS, {})
    s[key] = value
    lsWrite(LS_SETTINGS, s)
  },
  legacySnapshot: async () => null,
  createBackup: async () => ({ name: 'browser', date: new Date().toISOString(), localPath: null, sizeBytes: 0 }),
  listBackups: async () => [],
  restoreBackup: async () => { throw new Error('Η επαναφορά λειτουργεί μόνο μέσα στην εφαρμογή.') },
  saveExport: async (name, bytes) => {
    const blob = new Blob([bytes], { type: 'application/octet-stream' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    return name
  },
  openUrl: async (url) => { window.open(url, '_blank') },
}

// ── Native ───────────────────────────────────────────────────────────────────

const native = {
  setup: () => invoke('setup_database'),
  getAppConfig: () => invoke('get_app_config'),
  setDataFolder: (path) => invoke('set_data_folder', { path }),
  loadAll: () => invoke('load_all'),
  apply: (ops) => invoke('apply_ops', { ops }),
  getSetting: (key) => invoke('get_setting', { key }),
  setSetting: (key, value) => invoke('set_setting', { key, value }),
  legacySnapshot: () => invoke('legacy_snapshot'),
  createBackup: () => invoke('create_backup'),
  listBackups: () => invoke('list_backups'),
  restoreBackup: (name) => invoke('restore_backup', { name }),
  saveExport: (name, bytes) => invoke('save_export', { name, bytes: Array.from(bytes) }),
  // Opener plugin, called directly (no extra npm package); allowed schemes
  // are listed in src-tauri/capabilities/default.json
  openUrl: (url) => invoke('plugin:opener|open_url', { url }),
}

export const backend = new Proxy({}, {
  get: (_, key) => (isTauri() ? native : browser)[key],
})

/** Readable message from anything a command can throw. */
export function errorText(err) {
  if (!err) return 'Άγνωστο σφάλμα'
  if (typeof err === 'string') return err
  return err.message ?? String(err)
}
