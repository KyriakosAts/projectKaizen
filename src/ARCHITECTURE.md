# Dojo Patras — Source Architecture

## Data Flow

```
Pages/Components → Contexts → services/dataService.js → Tauri invoke() → Rust commands → SQLite
                                        │ (browser/dev mode)
                                        └→ localStorage fallback (same command surface)
```

`src/services/dataService.js` is the **single dispatch point** — no page or component calls
`invoke()` directly. In the browser (plain `npm run dev`, outside Tauri) every command is served
by a localStorage mirror with identical signatures.

## Pages (`src/pages/`)
| File | Route | Description |
|------|-------|-------------|
| Dashboard.jsx | /dashboard | Stats, charts, unpaid list |
| Members.jsx | /members | Member table + Add/Edit modal |
| MemberProfile.jsx | /members/:id | Member detail, stats, notes, payments |
| Payments.jsx | /payments | Monthly payment table, mark paid |
| Activity.jsx | /activity | Weekly/Monthly attendance Gantt |
| Schedule.jsx | /schedule | Class schedule management |
| Services.jsx | /services | Service/category management |
| Settings.jsx | /settings | App settings, shortcuts, import, database & backups |

## Components (`src/components/`)
| File | Description |
|------|-------------|
| AttendanceModal.jsx | Attendance log modal (daily sessions + quick-log) |
| MemberStatsCard.jsx | Activity & Payments charts card (used in MemberProfile) |
| MemberNotesCard.jsx | Notes & Activity Log card (used in MemberProfile) |
| BeltHistoryCard.jsx | Belt Promotion History card (used in MemberProfile) |
| MemberModal.jsx | Add/Edit member form modal (includes payment backfill prompt) |
| ExportModal.jsx | Export modal — Excel, JSON backup, snapshots + restore |

## Layout (`src/components/layout/`)
Layout.jsx (root layout + global shortcuts) · Sidebar.jsx · TopBar.jsx (search, export, theme)

## UI Primitives (`src/components/ui/`)
Badge, Button, Card, Input, Modal, StatCard, Avatar, LoadingSpinner

## Contexts (`src/contexts/`)
| File | Storage | Key exports |
|------|---------|-------------|
| DataContext.jsx | SQLite (via dataService) | members, payments, attendance, comments, beltHistory, memberNotes; all CRUD; cascade delete; `reload` |
| ScheduleContext.jsx | SQLite settings (`schedule_config` JSON) | classes, events CRUD (debounced save) |
| ServicesContext.jsx | SQLite settings (`services_config` JSON) | services, addService, updateService, getMemberFee |
| InstructorsContext.jsx | SQLite settings (`instructors_config` JSON) | instructors CRUD |
| ThemeContext.jsx | localStorage (UI prefs only) | theme, accent, ACCENT_PALETTES, logo, gymName |

Config contexts only enable autosave **after a successful load** — a failed load can never cause
defaults to overwrite the stored config.

## Rust Backend (`src-tauri/src/`)
| File | Description |
|------|-------------|
| db.rs | SQLite schema + all data access. UUID text PKs, FK `ON DELETE CASCADE`, WAL mode. Snapshot/restore for backups. |
| mirror.rs | Background thread that rewrites the Excel mirror (.xlsx) ~2s after any mutation. Retries if the file is locked. |
| state.rs | `AppState` (DB connection + mirror handle) and `with_db` helpers. |
| models.rs | Serde models (camelCase over the wire) + Excel sheet headers. |
| commands/ | One file per entity: setup, members, payments, attendance, belt, notes, comments, config_cmds, backup. |

### Key backend behaviors
- **Cascade delete**: `DELETE FROM members WHERE id=?` — foreign keys remove all child rows atomically.
- **Event-payment dedup**: `add_payment` returns `null` when an identical `(memberId, month, note)` event payment exists.
- **Comments**: `UNIQUE(member_id, month)` + upsert; empty text deletes.
- **Backups**: `dojo-backup-YYYY-MM-DD_HH-MM-SS.json` in `{data folder}/backups`, daily auto (30 kept) + manual. `restore_backup` always writes a `pre-restore-…` safety snapshot first (5 kept).
- **Settings** table (key/value): the three config JSON blobs, `data_folder`, `last_backup`.

## Storage locations
```
{AppData}/com.dojopatras.app/dojo.db          — SQLite database (source of truth)
{Documents}/Dojo Patras/dojo-patras-database.xlsx — Excel mirror (auto-updated, human-readable)
{Documents}/Dojo Patras/backups/*.json        — restorable snapshots
```
The data folder is configurable in Settings → Database & Backups (e.g. point it at OneDrive).

## Utils (`src/utils/`)
| File | Description |
|------|-------------|
| helpers.js | BELT_COLORS, BELT_LABELS, formatters, toDate, currentMonthStr, hexToRgba |
| export.js | exportToExcel (filtered report), exportToJSON (manual download) |
| validators.js | validateMember, validatePayment, validateBeltPromotion, validateService, validateAttendance, validateInstructor |

## Desktop (Tauri)
- Run dev: `npm run tauri:dev` · Build: `npm run tauri:build`
- CI: `.github/workflows/build.yml` builds the Windows installer on push (no secrets needed).
