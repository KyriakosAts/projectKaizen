//! SQLite data layer — the single source of truth for all app data.
//!
//! Since v3 the database is a small document store: every record is a JSON
//! document in `docs`, addressed by (collection, id). The data model lives
//! entirely in the frontend (src/data), so changing it never needs a new
//! native build. `settings` holds app configuration as key → JSON text.
//!
//! Tables from the v2 schema (members, payments, …) are left untouched on
//! upgraded devices; `legacy_snapshot` reads them once so the frontend can
//! migrate them into documents.

use rusqlite::{params, types::ValueRef, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::path::Path;

const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS docs (
    collection TEXT NOT NULL,
    id         TEXT NOT NULL,
    data       TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (collection, id)
);

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"#;

/// Settings that describe this device, not the gym's data — never part of a
/// backup and never overwritten by a restore.
pub const SETTING_DATA_FOLDER: &str = "data_folder";
pub const SETTING_LAST_BACKUP: &str = "last_backup";
const DEVICE_SETTINGS: [&str; 2] = [SETTING_DATA_FOLDER, SETTING_LAST_BACKUP];

/// v2 tables, in the order the migration needs them.
const LEGACY_TABLES: [&str; 6] = [
    "members",
    "payments",
    "attendance",
    "belt_history",
    "member_notes",
    "comments",
];
const LEGACY_SETTINGS: [&str; 1] = ["services_config"];

pub fn open(path: &Path) -> Result<Connection, String> {
    let conn = Connection::open(path).map_err(|e| format!("Cannot open database: {e}"))?;
    conn.busy_timeout(std::time::Duration::from_millis(5000))
        .map_err(|e| format!("Cannot set busy timeout: {e}"))?;
    conn.pragma_update(None, "journal_mode", "WAL")
        .map_err(|e| format!("Cannot enable WAL: {e}"))?;
    conn.execute_batch(SCHEMA)
        .map_err(|e| format!("Cannot create schema: {e}"))?;
    Ok(conn)
}

fn db_err(e: rusqlite::Error) -> String {
    format!("Database error: {e}")
}

fn now() -> String {
    chrono::Utc::now().to_rfc3339()
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

/// All gym settings (device settings excluded), as key → raw value text.
fn gym_settings(conn: &Connection) -> Result<Map<String, Value>, String> {
    let mut stmt = conn.prepare("SELECT key, value FROM settings").map_err(db_err)?;
    let rows = stmt
        .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
        .map_err(db_err)?;
    let mut out = Map::new();
    for row in rows {
        let (k, v) = row.map_err(db_err)?;
        if !DEVICE_SETTINGS.contains(&k.as_str()) {
            out.insert(k, Value::String(v));
        }
    }
    Ok(out)
}

// ─── Documents ─────────────────────────────────────────────────────────────────

/// Every document, grouped by collection: `{ "members": [ {...}, … ], … }`.
/// Each document carries its own `id` field (written by the frontend).
pub fn load_docs(conn: &Connection) -> Result<Map<String, Value>, String> {
    let mut stmt = conn
        .prepare("SELECT collection, data FROM docs ORDER BY collection, id")
        .map_err(db_err)?;
    let rows = stmt
        .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
        .map_err(db_err)?;
    let mut out = Map::new();
    for row in rows {
        let (collection, data) = row.map_err(db_err)?;
        let doc: Value = serde_json::from_str(&data)
            .map_err(|e| format!("Corrupt document in '{collection}': {e}"))?;
        match out
            .entry(collection)
            .or_insert_with(|| Value::Array(Vec::new()))
        {
            Value::Array(list) => list.push(doc),
            _ => unreachable!("collections are always arrays"),
        }
    }
    Ok(out)
}

/// One write in an atomic batch. `put` inserts or replaces the whole document.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Op {
    pub op: String,
    pub collection: String,
    pub id: String,
    #[serde(default)]
    pub data: Option<Value>,
}

/// Apply a batch of writes in one transaction: either all land or none do.
pub fn apply_ops(conn: &mut Connection, ops: &[Op]) -> Result<(), String> {
    let tx = conn.transaction().map_err(db_err)?;
    let ts = now();
    for op in ops {
        if op.collection.is_empty() || op.id.is_empty() {
            return Err("Every write needs a collection and an id".to_string());
        }
        match op.op.as_str() {
            "put" => {
                let data = op
                    .data
                    .as_ref()
                    .ok_or_else(|| format!("put {}/{} has no data", op.collection, op.id))?;
                let text = serde_json::to_string(data).map_err(|e| format!("Serialize error: {e}"))?;
                tx.execute(
                    "INSERT INTO docs (collection, id, data, updated_at) VALUES (?1, ?2, ?3, ?4)
                     ON CONFLICT(collection, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at",
                    params![op.collection, op.id, text, ts],
                )
                .map_err(db_err)?;
            }
            "delete" => {
                tx.execute(
                    "DELETE FROM docs WHERE collection = ?1 AND id = ?2",
                    params![op.collection, op.id],
                )
                .map_err(db_err)?;
            }
            other => return Err(format!("Unknown write operation '{other}'")),
        }
    }
    tx.commit().map_err(db_err)
}

// ─── Legacy (v2) data ──────────────────────────────────────────────────────────

fn table_exists(conn: &Connection, table: &str) -> Result<bool, String> {
    conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?1)",
        params![table],
        |r| r.get(0),
    )
    .map_err(db_err)
}

fn value_from_sql(v: ValueRef) -> Value {
    match v {
        ValueRef::Null => Value::Null,
        ValueRef::Integer(i) => Value::from(i),
        ValueRef::Real(f) => Value::from(f),
        ValueRef::Text(t) => Value::String(String::from_utf8_lossy(t).into_owned()),
        ValueRef::Blob(_) => Value::Null,
    }
}

/// Every row of a table as a JSON object keyed by column name.
fn table_rows(conn: &Connection, table: &str) -> Result<Vec<Value>, String> {
    // `table` only ever comes from LEGACY_TABLES — never from the frontend
    let mut stmt = conn.prepare(&format!("SELECT * FROM {table}")).map_err(db_err)?;
    let columns: Vec<String> = stmt.column_names().iter().map(|c| c.to_string()).collect();
    let mut rows = stmt.query([]).map_err(db_err)?;
    let mut out = Vec::new();
    while let Some(row) = rows.next().map_err(db_err)? {
        let mut obj = Map::new();
        for (i, col) in columns.iter().enumerate() {
            obj.insert(col.clone(), value_from_sql(row.get_ref(i).map_err(db_err)?));
        }
        out.push(Value::Object(obj));
    }
    Ok(out)
}

/// The v2 tables' contents (`{ members: [...], …, settings: {...} }`), or
/// `None` when this database never had v2 data.
pub fn legacy_snapshot(conn: &Connection) -> Result<Option<Value>, String> {
    let mut out = Map::new();
    let mut any_rows = false;
    for table in LEGACY_TABLES {
        let rows = if table_exists(conn, table)? { table_rows(conn, table)? } else { Vec::new() };
        any_rows |= !rows.is_empty();
        out.insert(table.to_string(), Value::Array(rows));
    }
    let mut settings = Map::new();
    for key in LEGACY_SETTINGS {
        if let Some(v) = get_setting(conn, key)? {
            settings.insert(key.to_string(), Value::String(v));
        }
    }
    if !any_rows && settings.is_empty() {
        return Ok(None);
    }
    out.insert("settings".to_string(), Value::Object(settings));
    Ok(Some(Value::Object(out)))
}

// ─── Full snapshot (backups + restore) ─────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Snapshot {
    pub docs: Map<String, Value>,
    pub settings: Map<String, Value>,
}

pub fn snapshot_all(conn: &Connection) -> Result<Snapshot, String> {
    Ok(Snapshot {
        docs: load_docs(conn)?,
        settings: gym_settings(conn)?,
    })
}

/// Number of documents in a snapshot (for restore feedback).
pub fn doc_count(snap: &Snapshot) -> usize {
    snap.docs
        .values()
        .map(|v| v.as_array().map(|a| a.len()).unwrap_or(0))
        .sum()
}

/// Replace ALL documents and gym settings with the snapshot's, atomically.
/// Device settings (data folder, last backup) are kept.
pub fn restore_all(conn: &mut Connection, snap: &Snapshot) -> Result<(), String> {
    let tx = conn.transaction().map_err(db_err)?;
    let ts = now();
    tx.execute("DELETE FROM docs", []).map_err(db_err)?;
    for (collection, list) in &snap.docs {
        let list = list
            .as_array()
            .ok_or_else(|| format!("Backup collection '{collection}' is not a list"))?;
        for doc in list {
            let id = doc
                .get("id")
                .and_then(|v| v.as_str())
                .ok_or_else(|| format!("A '{collection}' record in the backup has no id"))?;
            let text = serde_json::to_string(doc).map_err(|e| format!("Serialize error: {e}"))?;
            tx.execute(
                "INSERT OR REPLACE INTO docs (collection, id, data, updated_at) VALUES (?1, ?2, ?3, ?4)",
                params![collection, id, text, ts],
            )
            .map_err(db_err)?;
        }
    }
    tx.execute(
        "DELETE FROM settings WHERE key NOT IN (?1, ?2)",
        params![SETTING_DATA_FOLDER, SETTING_LAST_BACKUP],
    )
    .map_err(db_err)?;
    for (key, value) in &snap.settings {
        if DEVICE_SETTINGS.contains(&key.as_str()) {
            continue;
        }
        let text = match value {
            Value::String(s) => s.clone(),
            other => other.to_string(),
        };
        tx.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)",
            params![key, text],
        )
        .map_err(db_err)?;
    }
    tx.commit().map_err(db_err)
}
