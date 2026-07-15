//! Excel mirror — keeps a human-readable .xlsx copy of the database on disk.
//!
//! Commands mark the mirror dirty after every mutation; a background thread
//! (with its own SQLite connection — WAL allows concurrent readers) debounces
//! and rewrites the workbook. If the file is locked (open in Excel) the write
//! is retried on the next cycle, so a failed export can never lose data —
//! the database remains the source of truth.

use rust_xlsxwriter::{Format, Workbook};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use crate::db::{self, Snapshot};
use crate::models::*;

pub const MIRROR_FILENAME: &str = "dojo-patras-database.xlsx";

#[derive(Clone)]
pub struct MirrorHandle {
    dirty: Arc<AtomicBool>,
    started: Arc<AtomicBool>,
}

impl MirrorHandle {
    pub fn new() -> Self {
        Self {
            dirty: Arc::new(AtomicBool::new(false)),
            started: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn mark_dirty(&self) {
        self.dirty.store(true, Ordering::SeqCst);
    }

    /// Spawn the background export thread (idempotent).
    pub fn start(&self, db_path: PathBuf) {
        if self.started.swap(true, Ordering::SeqCst) {
            return;
        }
        let dirty = Arc::clone(&self.dirty);
        std::thread::spawn(move || {
            let conn = loop {
                match db::open(&db_path) {
                    Ok(c) => break c,
                    Err(e) => {
                        eprintln!("[mirror] cannot open db, retrying: {e}");
                        std::thread::sleep(Duration::from_secs(10));
                    }
                }
            };
            loop {
                std::thread::sleep(Duration::from_secs(2));
                if !dirty.swap(false, Ordering::SeqCst) {
                    continue;
                }
                let result = db::snapshot_all(&conn)
                    .and_then(|snap| {
                        let folder = db::get_setting(&conn, db::SETTING_DATA_FOLDER)?
                            .ok_or_else(|| "data folder not configured".to_string())?;
                        export_xlsx(&snap, &Path::new(&folder).join(MIRROR_FILENAME))
                    });
                if let Err(e) = result {
                    eprintln!("[mirror] export failed (will retry): {e}");
                    dirty.store(true, Ordering::SeqCst);
                }
            }
        });
    }
}

/// Write the full snapshot as a formatted workbook. Writes to a temp file
/// first and renames over the target so a crash mid-write can't leave a
/// truncated mirror.
pub fn export_xlsx(snap: &Snapshot, target: &Path) -> Result<(), String> {
    let mut workbook = Workbook::new();
    let header_fmt = Format::new().set_bold();

    let write_sheet = |workbook: &mut Workbook, name: &str, rows: Vec<Vec<String>>| -> Result<(), String> {
        let sheet = workbook.add_worksheet();
        sheet.set_name(name).map_err(|e| e.to_string())?;
        for (c, h) in headers_for(name).iter().enumerate() {
            sheet
                .write_string_with_format(0, c as u16, *h, &header_fmt)
                .map_err(|e| e.to_string())?;
        }
        for (r, row) in rows.iter().enumerate() {
            for (c, val) in row.iter().enumerate() {
                sheet
                    .write_string((r + 1) as u32, c as u16, val.as_str())
                    .map_err(|e| e.to_string())?;
            }
        }
        Ok(())
    };

    let opt = |o: &Option<String>| o.clone().unwrap_or_default();

    write_sheet(
        &mut workbook,
        SHEET_MEMBERS,
        snap.members.iter().map(|m| vec![
            m.id.clone(), m.name.clone(), opt(&m.phone), opt(&m.email),
            m.categories.clone(), m.belts.clone(), m.service_dates.clone(),
            m.join_date.clone(), m.status.clone(), opt(&m.custom_fee), opt(&m.notes),
            m.created_at.clone(), m.updated_at.clone(),
        ]).collect(),
    )?;
    write_sheet(
        &mut workbook,
        SHEET_PAYMENTS,
        snap.payments.iter().map(|p| vec![
            p.id.clone(), p.member_id.clone(), p.month.clone(), p.amount.clone(),
            p.status.clone(), opt(&p.paid_at), opt(&p.note), p.created_at.clone(),
        ]).collect(),
    )?;
    write_sheet(
        &mut workbook,
        SHEET_ATTENDANCE,
        snap.attendance.iter().map(|a| vec![
            a.id.clone(), a.member_id.clone(), a.date.clone(), a.session_type.clone(),
            opt(&a.note), opt(&a.class_id), a.created_at.clone(),
        ]).collect(),
    )?;
    write_sheet(
        &mut workbook,
        SHEET_BELT_HISTORY,
        snap.belt_history.iter().map(|b| vec![
            b.id.clone(), b.member_id.clone(), b.category.clone(), opt(&b.from_belt),
            b.to_belt.clone(), b.promoted_at.clone(), opt(&b.notes), b.created_at.clone(),
        ]).collect(),
    )?;
    write_sheet(
        &mut workbook,
        SHEET_MEMBER_NOTES,
        snap.member_notes.iter().map(|n| vec![
            n.id.clone(), n.member_id.clone(), n.text.clone(), n.created_at.clone(),
        ]).collect(),
    )?;
    write_sheet(
        &mut workbook,
        SHEET_COMMENTS,
        snap.comments.iter().map(|c| vec![
            c.id.clone(), c.member_id.clone(), c.month.clone(), c.text.clone(), c.updated_at.clone(),
        ]).collect(),
    )?;
    write_sheet(
        &mut workbook,
        SHEET_CONFIG,
        vec![
            vec!["services".to_string(), opt(&snap.config.services)],
            vec!["schedule".to_string(), opt(&snap.config.schedule)],
            vec!["instructors".to_string(), opt(&snap.config.instructors)],
        ],
    )?;

    if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Cannot create mirror folder: {e}"))?;
    }
    let tmp = target.with_extension("xlsx.tmp");
    workbook
        .save(&tmp)
        .map_err(|e| format!("Cannot write Excel mirror: {e}"))?;
    std::fs::rename(&tmp, target).map_err(|e| {
        let _ = std::fs::remove_file(&tmp);
        format!("Cannot replace Excel mirror (is it open in Excel?): {e}")
    })
}
