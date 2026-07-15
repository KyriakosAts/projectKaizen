//! SQLite data layer — the single source of truth for all app data.
//!
//! The database lives at `{app_data_dir}/dojo.db` (WAL mode). All rows are
//! addressed by UUID primary keys, and every member-owned table declares
//! `ON DELETE CASCADE`, so deleting a member atomically removes all of their
//! payments, attendance, belt history, notes and comments.

use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::{Deserialize, Serialize};
use std::path::Path;

use crate::models::*;

const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS members (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    phone         TEXT,
    email         TEXT,
    categories    TEXT NOT NULL DEFAULT '[]',
    belts         TEXT NOT NULL DEFAULT '{}',
    service_dates TEXT NOT NULL DEFAULT '{}',
    join_date     TEXT NOT NULL DEFAULT '',
    status        TEXT NOT NULL DEFAULT 'active',
    custom_fee    TEXT,
    notes         TEXT,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
    id         TEXT PRIMARY KEY,
    member_id  TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    month      TEXT NOT NULL,
    amount     TEXT NOT NULL DEFAULT '0',
    status     TEXT NOT NULL DEFAULT 'unpaid',
    paid_at    TEXT,
    note       TEXT,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payments_member ON payments(member_id);
CREATE INDEX IF NOT EXISTS idx_payments_month  ON payments(month);

CREATE TABLE IF NOT EXISTS attendance (
    id           TEXT PRIMARY KEY,
    member_id    TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    date         TEXT NOT NULL,
    session_type TEXT NOT NULL DEFAULT '',
    note         TEXT,
    class_id     TEXT,
    created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attendance_member ON attendance(member_id);

CREATE TABLE IF NOT EXISTS belt_history (
    id          TEXT PRIMARY KEY,
    member_id   TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    category    TEXT NOT NULL DEFAULT '',
    from_belt   TEXT,
    to_belt     TEXT NOT NULL DEFAULT '',
    promoted_at TEXT NOT NULL DEFAULT '',
    notes       TEXT,
    created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_belt_member ON belt_history(member_id);

CREATE TABLE IF NOT EXISTS member_notes (
    id         TEXT PRIMARY KEY,
    member_id  TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    text       TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notes_member ON member_notes(member_id);

CREATE TABLE IF NOT EXISTS comments (
    id         TEXT PRIMARY KEY,
    member_id  TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    month      TEXT NOT NULL,
    text       TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL,
    UNIQUE(member_id, month)
);

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS logs (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    action    TEXT NOT NULL,
    collection TEXT NOT NULL,
    record_id TEXT NOT NULL,
    details   TEXT NOT NULL
);
"#;

pub fn open(path: &Path) -> Result<Connection, String> {
    let conn = Connection::open(path).map_err(|e| format!("Cannot open database: {e}"))?;
    conn.busy_timeout(std::time::Duration::from_millis(5000))
        .map_err(|e| format!("Cannot set busy timeout: {e}"))?;
    conn.pragma_update(None, "journal_mode", "WAL")
        .map_err(|e| format!("Cannot enable WAL: {e}"))?;
    conn.pragma_update(None, "foreign_keys", "ON")
        .map_err(|e| format!("Cannot enable foreign keys: {e}"))?;
    conn.execute_batch(SCHEMA)
        .map_err(|e| format!("Cannot create schema: {e}"))?;
    // Keep the audit log bounded
    let _ = conn.execute(
        "DELETE FROM logs WHERE id < (SELECT COALESCE(MAX(id), 0) FROM logs) - 10000",
        [],
    );
    Ok(conn)
}

fn db_err(e: rusqlite::Error) -> String {
    format!("Database error: {e}")
}

// ─── Settings (key/value) ──────────────────────────────────────────────────────

pub fn get_setting(conn: &Connection, key: &str) -> Result<Option<String>, String> {
    conn.query_row("SELECT value FROM settings WHERE key = ?1", params![key], |r| r.get(0))
        .optional()
        .map_err(db_err)
}

pub fn set_setting(conn: &Connection, key: &str, value: &str) -> Result<(), String> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )
    .map(|_| ())
    .map_err(db_err)
}

// ─── Audit log ─────────────────────────────────────────────────────────────────

pub fn log_action(conn: &Connection, action: &str, collection: &str, record_id: &str, details: &str) {
    let _ = conn.execute(
        "INSERT INTO logs (timestamp, action, collection, record_id, details) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![chrono::Utc::now().to_rfc3339(), action, collection, record_id, details],
    );
}

// ─── Row mappers ───────────────────────────────────────────────────────────────

fn member_from_row(r: &Row) -> rusqlite::Result<Member> {
    Ok(Member {
        id: r.get("id")?,
        name: r.get("name")?,
        phone: r.get("phone")?,
        email: r.get("email")?,
        categories: r.get("categories")?,
        belts: r.get("belts")?,
        service_dates: r.get("service_dates")?,
        join_date: r.get("join_date")?,
        status: r.get("status")?,
        custom_fee: r.get("custom_fee")?,
        notes: r.get("notes")?,
        created_at: r.get("created_at")?,
        updated_at: r.get("updated_at")?,
    })
}

fn payment_from_row(r: &Row) -> rusqlite::Result<Payment> {
    Ok(Payment {
        id: r.get("id")?,
        member_id: r.get("member_id")?,
        month: r.get("month")?,
        amount: r.get("amount")?,
        status: r.get("status")?,
        paid_at: r.get("paid_at")?,
        note: r.get("note")?,
        created_at: r.get("created_at")?,
    })
}

fn attendance_from_row(r: &Row) -> rusqlite::Result<Attendance> {
    Ok(Attendance {
        id: r.get("id")?,
        member_id: r.get("member_id")?,
        date: r.get("date")?,
        session_type: r.get("session_type")?,
        note: r.get("note")?,
        class_id: r.get("class_id")?,
        created_at: r.get("created_at")?,
    })
}

fn belt_from_row(r: &Row) -> rusqlite::Result<BeltEntry> {
    Ok(BeltEntry {
        id: r.get("id")?,
        member_id: r.get("member_id")?,
        category: r.get("category")?,
        from_belt: r.get("from_belt")?,
        to_belt: r.get("to_belt")?,
        promoted_at: r.get("promoted_at")?,
        notes: r.get("notes")?,
        created_at: r.get("created_at")?,
    })
}

fn note_from_row(r: &Row) -> rusqlite::Result<MemberNote> {
    Ok(MemberNote {
        id: r.get("id")?,
        member_id: r.get("member_id")?,
        text: r.get("text")?,
        created_at: r.get("created_at")?,
    })
}

fn comment_from_row(r: &Row) -> rusqlite::Result<Comment> {
    Ok(Comment {
        id: r.get("id")?,
        member_id: r.get("member_id")?,
        month: r.get("month")?,
        text: r.get("text")?,
        updated_at: r.get("updated_at")?,
    })
}

fn query_all<T>(
    conn: &Connection,
    sql: &str,
    mapper: fn(&Row) -> rusqlite::Result<T>,
) -> Result<Vec<T>, String> {
    let mut stmt = conn.prepare(sql).map_err(db_err)?;
    let rows = stmt.query_map([], mapper).map_err(db_err)?;
    rows.collect::<rusqlite::Result<Vec<T>>>().map_err(db_err)
}

// ─── Members ───────────────────────────────────────────────────────────────────

pub fn list_members(conn: &Connection) -> Result<Vec<Member>, String> {
    query_all(conn, "SELECT * FROM members ORDER BY created_at DESC", member_from_row)
}

pub fn insert_member(conn: &Connection, m: &Member) -> Result<(), String> {
    conn.execute(
        "INSERT INTO members (id, name, phone, email, categories, belts, service_dates, join_date, status, custom_fee, notes, created_at, updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)",
        params![m.id, m.name, m.phone, m.email, m.categories, m.belts, m.service_dates, m.join_date, m.status, m.custom_fee, m.notes, m.created_at, m.updated_at],
    )
    .map(|_| ())
    .map_err(db_err)
}

pub fn update_member(conn: &Connection, id: &str, d: &MemberInput, updated_at: &str) -> Result<(), String> {
    let n = conn
        .execute(
            "UPDATE members SET name=?1, phone=?2, email=?3, categories=?4, belts=?5, service_dates=?6, join_date=?7, status=?8, custom_fee=?9, notes=?10, updated_at=?11
             WHERE id=?12",
            params![d.name, d.phone, d.email, d.categories, d.belts, d.service_dates, d.join_date, d.status, d.custom_fee, d.notes, updated_at, id],
        )
        .map_err(db_err)?;
    if n == 0 {
        return Err(format!("Member '{id}' not found"));
    }
    Ok(())
}

/// FK cascade removes all payments/attendance/belt history/notes/comments atomically.
pub fn delete_member_cascade(conn: &Connection, id: &str) -> Result<(), String> {
    let n = conn
        .execute("DELETE FROM members WHERE id=?1", params![id])
        .map_err(db_err)?;
    if n == 0 {
        return Err(format!("Member '{id}' not found"));
    }
    Ok(())
}

// ─── Payments ──────────────────────────────────────────────────────────────────

pub fn list_payments(conn: &Connection) -> Result<Vec<Payment>, String> {
    query_all(conn, "SELECT * FROM payments ORDER BY created_at DESC", payment_from_row)
}

pub fn payment_duplicate_exists(conn: &Connection, member_id: &str, month: &str, note: &str) -> Result<bool, String> {
    conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM payments WHERE member_id=?1 AND month=?2 AND note IS ?3)",
        params![member_id, month, note],
        |r| r.get(0),
    )
    .map_err(db_err)
}

pub fn insert_payment(conn: &Connection, p: &Payment) -> Result<(), String> {
    conn.execute(
        "INSERT INTO payments (id, member_id, month, amount, status, paid_at, note, created_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
        params![p.id, p.member_id, p.month, p.amount, p.status, p.paid_at, p.note, p.created_at],
    )
    .map(|_| ())
    .map_err(db_err)
}

pub fn set_payment_status(conn: &Connection, id: &str, status: &str, paid_at: Option<&str>) -> Result<(), String> {
    let n = conn
        .execute(
            "UPDATE payments SET status=?1, paid_at=?2 WHERE id=?3",
            params![status, paid_at, id],
        )
        .map_err(db_err)?;
    if n == 0 {
        return Err(format!("Payment '{id}' not found"));
    }
    Ok(())
}

// ─── Attendance ────────────────────────────────────────────────────────────────

pub fn list_attendance(conn: &Connection) -> Result<Vec<Attendance>, String> {
    query_all(conn, "SELECT * FROM attendance ORDER BY created_at DESC", attendance_from_row)
}

pub fn insert_attendance(conn: &Connection, a: &Attendance) -> Result<(), String> {
    conn.execute(
        "INSERT INTO attendance (id, member_id, date, session_type, note, class_id, created_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7)",
        params![a.id, a.member_id, a.date, a.session_type, a.note, a.class_id, a.created_at],
    )
    .map(|_| ())
    .map_err(db_err)
}

pub fn delete_attendance(conn: &Connection, id: &str) -> Result<(), String> {
    let n = conn
        .execute("DELETE FROM attendance WHERE id=?1", params![id])
        .map_err(db_err)?;
    if n == 0 {
        return Err(format!("Attendance record '{id}' not found"));
    }
    Ok(())
}

// ─── Belt history ──────────────────────────────────────────────────────────────

pub fn list_belt_history(conn: &Connection) -> Result<Vec<BeltEntry>, String> {
    query_all(conn, "SELECT * FROM belt_history ORDER BY promoted_at DESC, created_at DESC", belt_from_row)
}

pub fn insert_belt_entry(conn: &Connection, b: &BeltEntry) -> Result<(), String> {
    conn.execute(
        "INSERT INTO belt_history (id, member_id, category, from_belt, to_belt, promoted_at, notes, created_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
        params![b.id, b.member_id, b.category, b.from_belt, b.to_belt, b.promoted_at, b.notes, b.created_at],
    )
    .map(|_| ())
    .map_err(db_err)
}

// ─── Member notes ──────────────────────────────────────────────────────────────

pub fn list_member_notes(conn: &Connection) -> Result<Vec<MemberNote>, String> {
    query_all(conn, "SELECT * FROM member_notes ORDER BY created_at DESC", note_from_row)
}

pub fn insert_member_note(conn: &Connection, n: &MemberNote) -> Result<(), String> {
    conn.execute(
        "INSERT INTO member_notes (id, member_id, text, created_at) VALUES (?1,?2,?3,?4)",
        params![n.id, n.member_id, n.text, n.created_at],
    )
    .map(|_| ())
    .map_err(db_err)
}

pub fn delete_member_note(conn: &Connection, id: &str) -> Result<(), String> {
    let n = conn
        .execute("DELETE FROM member_notes WHERE id=?1", params![id])
        .map_err(db_err)?;
    if n == 0 {
        return Err(format!("Note '{id}' not found"));
    }
    Ok(())
}

// ─── Comments ──────────────────────────────────────────────────────────────────

pub fn list_comments(conn: &Connection) -> Result<Vec<Comment>, String> {
    query_all(conn, "SELECT * FROM comments ORDER BY updated_at DESC", comment_from_row)
}

/// Empty text = delete the (member, month) comment; otherwise insert-or-update.
pub fn upsert_comment(conn: &Connection, member_id: &str, month: &str, text: &str, now: &str) -> Result<(), String> {
    if text.trim().is_empty() {
        conn.execute(
            "DELETE FROM comments WHERE member_id=?1 AND month=?2",
            params![member_id, month],
        )
        .map(|_| ())
        .map_err(db_err)
    } else {
        conn.execute(
            "INSERT INTO comments (id, member_id, month, text, updated_at) VALUES (?1,?2,?3,?4,?5)
             ON CONFLICT(member_id, month) DO UPDATE SET text = excluded.text, updated_at = excluded.updated_at",
            params![uuid::Uuid::new_v4().to_string(), member_id, month, text, now],
        )
        .map(|_| ())
        .map_err(db_err)
    }
}

// ─── Full snapshot (used by backups, restore, and the Excel mirror) ────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ConfigSnapshot {
    pub services: Option<String>,
    pub schedule: Option<String>,
    pub instructors: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub members: Vec<Member>,
    pub payments: Vec<Payment>,
    pub attendance: Vec<Attendance>,
    pub belt_history: Vec<BeltEntry>,
    pub member_notes: Vec<MemberNote>,
    pub comments: Vec<Comment>,
    #[serde(default)]
    pub config: ConfigSnapshot,
}

pub const SETTING_SERVICES: &str = "services_config";
pub const SETTING_SCHEDULE: &str = "schedule_config";
pub const SETTING_INSTRUCTORS: &str = "instructors_config";
pub const SETTING_DATA_FOLDER: &str = "data_folder";
pub const SETTING_LAST_BACKUP: &str = "last_backup";

pub fn snapshot_all(conn: &Connection) -> Result<Snapshot, String> {
    Ok(Snapshot {
        members: list_members(conn)?,
        payments: list_payments(conn)?,
        attendance: list_attendance(conn)?,
        belt_history: list_belt_history(conn)?,
        member_notes: list_member_notes(conn)?,
        comments: list_comments(conn)?,
        config: ConfigSnapshot {
            services: get_setting(conn, SETTING_SERVICES)?,
            schedule: get_setting(conn, SETTING_SCHEDULE)?,
            instructors: get_setting(conn, SETTING_INSTRUCTORS)?,
        },
    })
}

/// Replace ALL data with the snapshot's contents, atomically.
/// Foreign keys are suspended for the connection during the swap so that
/// child rows whose parent member is missing (from old exports) don't abort
/// the restore — they are re-imported as-is.
pub fn restore_all(conn: &mut Connection, snap: &Snapshot) -> Result<(), String> {
    conn.pragma_update(None, "foreign_keys", "OFF")
        .map_err(|e| format!("Cannot suspend foreign keys: {e}"))?;

    let result = (|| -> Result<(), String> {
        let tx = conn.transaction().map_err(db_err)?;
        tx.execute_batch(
            "DELETE FROM payments; DELETE FROM attendance; DELETE FROM belt_history;
             DELETE FROM member_notes; DELETE FROM comments; DELETE FROM members;",
        )
        .map_err(db_err)?;

        for m in &snap.members {
            tx.execute(
                "INSERT INTO members (id, name, phone, email, categories, belts, service_dates, join_date, status, custom_fee, notes, created_at, updated_at)
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)",
                params![m.id, m.name, m.phone, m.email, m.categories, m.belts, m.service_dates, m.join_date, m.status, m.custom_fee, m.notes, m.created_at, m.updated_at],
            ).map_err(db_err)?;
        }
        for p in &snap.payments {
            tx.execute(
                "INSERT INTO payments (id, member_id, month, amount, status, paid_at, note, created_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
                params![p.id, p.member_id, p.month, p.amount, p.status, p.paid_at, p.note, p.created_at],
            ).map_err(db_err)?;
        }
        for a in &snap.attendance {
            tx.execute(
                "INSERT INTO attendance (id, member_id, date, session_type, note, class_id, created_at) VALUES (?1,?2,?3,?4,?5,?6,?7)",
                params![a.id, a.member_id, a.date, a.session_type, a.note, a.class_id, a.created_at],
            ).map_err(db_err)?;
        }
        for b in &snap.belt_history {
            tx.execute(
                "INSERT INTO belt_history (id, member_id, category, from_belt, to_belt, promoted_at, notes, created_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
                params![b.id, b.member_id, b.category, b.from_belt, b.to_belt, b.promoted_at, b.notes, b.created_at],
            ).map_err(db_err)?;
        }
        for n in &snap.member_notes {
            tx.execute(
                "INSERT INTO member_notes (id, member_id, text, created_at) VALUES (?1,?2,?3,?4)",
                params![n.id, n.member_id, n.text, n.created_at],
            ).map_err(db_err)?;
        }
        for c in &snap.comments {
            tx.execute(
                "INSERT INTO comments (id, member_id, month, text, updated_at) VALUES (?1,?2,?3,?4,?5)",
                params![c.id, c.member_id, c.month, c.text, c.updated_at],
            ).map_err(db_err)?;
        }

        // Full fidelity: clear the config keys first so a snapshot taken
        // before a config existed doesn't inherit the current one
        tx.execute(
            "DELETE FROM settings WHERE key IN (?1, ?2, ?3)",
            params![SETTING_SERVICES, SETTING_SCHEDULE, SETTING_INSTRUCTORS],
        ).map_err(db_err)?;
        let mut set = |key: &str, val: &Option<String>| -> Result<(), String> {
            if let Some(v) = val {
                tx.execute(
                    "INSERT INTO settings (key, value) VALUES (?1, ?2)",
                    params![key, v],
                ).map(|_| ()).map_err(db_err)?;
            }
            Ok(())
        };
        set(SETTING_SERVICES, &snap.config.services)?;
        set(SETTING_SCHEDULE, &snap.config.schedule)?;
        set(SETTING_INSTRUCTORS, &snap.config.instructors)?;

        tx.commit().map_err(db_err)
    })();

    let reenable = conn
        .pragma_update(None, "foreign_keys", "ON")
        .map_err(|e| format!("Restore succeeded but foreign keys could not be re-enabled — restart the app: {e}"));
    result.and(reenable)
}
