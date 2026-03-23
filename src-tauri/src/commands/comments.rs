use chrono::Utc;
use tauri::State;
use uuid::Uuid;
use crate::{
    models::{Comment, SHEET_COMMENTS},
    state::{AppState, get_sheets},
};

fn row_to_comment(row: Vec<String>) -> Option<Comment> {
    if row.is_empty() { return None; }
    Some(Comment {
        id:         row.get(0).cloned().unwrap_or_default(),
        member_id:  row.get(1).cloned().unwrap_or_default(),
        month:      row.get(2).cloned().unwrap_or_default(),
        text:       row.get(3).cloned().unwrap_or_default(),
        updated_at: row.get(4).cloned().unwrap_or_default(),
    })
}

#[tauri::command]
pub async fn get_comments(state: State<'_, AppState>) -> Result<Vec<Comment>, String> {
    let sheets = get_sheets(&state).await?;
    let rows = sheets.get_all_rows(SHEET_COMMENTS).await?;
    Ok(rows.into_iter().filter_map(row_to_comment).collect())
}

/// Create, update, or delete a comment for a (member_id, month) pair.
/// Empty text = delete. Non-empty = upsert.
#[tauri::command]
pub async fn upsert_comment(
    state: State<'_, AppState>,
    member_id: String,
    month: String,
    text: String,
) -> Result<(), String> {
    let sheets = get_sheets(&state).await?;
    let rows   = sheets.get_all_rows(SHEET_COMMENTS).await?;

    // Find existing comment for this member+month combination
    let existing = rows.iter().enumerate().find(|(_, row)| {
        row.get(1).map(|s| s.as_str()) == Some(&member_id)
            && row.get(2).map(|s| s.as_str()) == Some(&month)
    });

    if text.trim().is_empty() {
        // Delete if present
        if let Some((idx, _)) = existing {
            let sheet_id = sheets.get_sheet_id(SHEET_COMMENTS).await?;
            sheets.delete_row(SHEET_COMMENTS, (idx + 1) as u32, sheet_id).await?;
        }
    } else if let Some((idx, row)) = existing {
        // Update in place
        let id = row.get(0).cloned().unwrap_or_default();
        let new_row = vec![id, member_id, month, text, Utc::now().to_rfc3339()];
        sheets.update_row(SHEET_COMMENTS, (idx + 1) as u32, new_row).await?;
    } else {
        // Insert new
        let id  = Uuid::new_v4().to_string();
        let row = vec![id, member_id, month, text, Utc::now().to_rfc3339()];
        sheets.append_row(SHEET_COMMENTS, row).await?;
    }
    Ok(())
}
