# Dojo Patras — Source Architecture

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
| Settings.jsx | /settings | App settings, shortcuts, import |
| AttendancePage.jsx | /attendance | Attendance list view |

## Components (`src/components/`)
| File | Description |
|------|-------------|
| AttendanceModal.jsx | Attendance log modal (daily sessions + quick-log) |
| MemberStatsCard.jsx | Activity & Payments charts card (used in MemberProfile) |
| MemberNotesCard.jsx | Notes & Activity Log card (used in MemberProfile) |
| BeltHistoryCard.jsx | Belt Promotion History card (used in MemberProfile) |
| MemberModal.jsx | Add/Edit member form modal (includes payment backfill prompt) |
| ExportModal.jsx | Export modal — Excel, JSON backup, auto-backup history |

## Layout (`src/components/layout/`)
| File | Description |
|------|-------------|
| Layout.jsx | Root layout: Sidebar + TopBar + Outlet + global shortcuts |
| Sidebar.jsx | Navigation sidebar |
| TopBar.jsx | Top bar with search (Ctrl+K), export, theme toggle |

## UI Primitives (`src/components/ui/`)
Badge, Button, Card, Input, Modal, StatCard, Avatar, LoadingSpinner

## Contexts (`src/contexts/`)
| File | Backend | Key exports |
|------|---------|-------------|
| DataContext.jsx | Firestore | members, payments, attendance, comments, beltHistory, memberNotes; all CRUD; cascade delete |
| ScheduleContext.jsx | Firestore (`config/schedule`) | classes, events; addClass/updateClass/removeClass/addEvent/updateEvent/removeEvent |
| ServicesContext.jsx | Firestore (`config/services`) | services, addService, updateService, getMemberFee |
| ThemeContext.jsx | localStorage (UI prefs only) | theme, accent, ACCENT_PALETTES, logo, gymName |
| InstructorsContext.jsx | Firestore (`config/instructors`) | instructors CRUD |

## Firebase Services (`src/firebase/`)
| File | Collection | Description |
|------|-----------|-------------|
| config.js | — | Firebase app init, exports `db` |
| memberService.js | `members` | getMembers, addMember, updateMember, deleteMember, **deleteMemberCascade** |
| paymentService.js | `payments` | getPayments, markPaid, markUnpaid, ensurePaymentsExist, deletePaymentsForMember |
| attendanceService.js | `attendance` | getAttendance, logAttendance, removeAttendance, deleteAttendanceForMember |
| beltService.js | `beltHistory` | getBeltHistory, addBeltPromotion, deleteBeltHistoryForMember |
| notesService.js | `memberNotes` | getMemberNotes, addMemberNote, deleteMemberNote, deleteMemberNotesForMember |
| commentsService.js | `comments` | getComments, upsertComment (create/update/delete), deleteCommentsForMember |
| configService.js | `config` | get/saveServicesConfig, get/saveScheduleConfig, get/saveInstructorsConfig |

## Utils (`src/utils/`)
| File | Description |
|------|-------------|
| helpers.js | BELT_COLORS, BELT_LABELS, formatters, toDate, currentMonthStr, hexToRgba |
| export.js | exportToExcel (XLSX), exportToJSON (full backup), saveAutoBackup, getAutoBackups, restoreAutoBackup |
| validators.js | validateMember, validatePayment, validateBeltPromotion, validateService, validateAttendance, validateInstructor |

## Key Patterns
- **Data layer**: All data in Firestore. No mock mode. ThemeContext is the only localStorage-persisted context (UI preferences only).
- **One-time migration**: On first Firebase load, if localStorage has legacy data (from the old mock mode), it is automatically migrated to Firestore and the `dojo_migrated_v1` key is set.
- **Cascade delete**: `deleteMember(id)` calls `deleteMemberCascade()` which removes all related payments, attendance, belt history, notes, and comments in parallel before deleting the member document.
- **Optimistic updates**: Every write operation immediately updates React state for instant UI feedback, without waiting for Firestore confirmation.
- **Auto-backup**: On each daily app load, a snapshot of all data is saved to localStorage (3-day rolling window) via `saveAutoBackup()`.
- **Event payments**: identified by `payment.note?.includes('(event)')` — one per member per event per month (deduplicated on write).
- **classId**: attendance records store `classId` linking to a schedule class ID or event ID.
- **Accent palettes**: ACCENT_PALETTES in ThemeContext maps accent name → hex color for charts.

## Firestore Collections
```
/members/{memberId}          — member roster
/payments/{paymentId}        — monthly payments
/attendance/{attendanceId}   — session attendance logs
/beltHistory/{entryId}       — belt promotion records
/memberNotes/{noteId}        — freeform member notes
/comments/{commentId}        — month-level comments
/config/services             — service definitions (single doc)
/config/schedule             — classes + events (single doc)
/config/instructors          — instructor list (single doc)
```

## Desktop (Tauri)
The app is packaged as a native desktop app using **Tauri v2**.
- Source: `src-tauri/`
- Config: `src-tauri/tauri.conf.json`
- Run dev: `npm run tauri:dev`
- Build: `npm run tauri:build` → produces installer in `src-tauri/target/release/bundle/`

## Backup Strategy
1. **Auto-backup** (daily, automatic): `saveAutoBackup()` in DataContext saves a JSON snapshot to localStorage on each daily app load. Keeps 3 days of history. Accessible via Export → Backups tab.
2. **Manual JSON export**: Full database dump downloadable from Export → JSON tab. Includes all 10 collections.
3. **Manual Excel export**: Filtered spreadsheet for reporting from Export → Excel tab.
4. **Firebase**: Firestore itself acts as the primary persistent data store. Enable Firebase backups in the Google Cloud Console for automated off-device backups.
