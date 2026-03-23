use chrono::Utc;
use tauri::State;
use uuid::Uuid;
use crate::{
    models::{Payment, PaymentInput, SHEET_PAYMENTS},
    state::{AppState, get_sheets},
};

fn row_to_payment(row: Vec<String>) -> Option<Payment> {
    if row.is_empty() { return None; }
    Some(Payment {
        id:         row.get(0).cloned().unwrap_or_default(),
        member_id:  row.get(1).cloned().unwrap_or_default(),
        month:      row.get(2).cloned().unwrap_or_default(),
        amount:     row.get(3).cloned().unwrap_or_else(|| "0".to_string()),
        status:     row.get(4).cloned().unwrap_or_else(|| "unpaid".to_string()),
        paid_at:    row.get(5).filter(|s| !s.is_empty()).cloned(),
        note:       row.get(6).filter(|s| !s.is_empty()).cloned(),
        created_at: row.get(7).cloned().unwrap_or_default(),
    })
}

fn payment_to_row(p: &Payment) -> Vec<String> {
    vec![
        p.id.clone(),
        p.member_id.clone(),
        p.month.clone(),
        p.amount.clone(),
        p.status.clone(),
        p.paid_at.clone().unwrap_or_default(),
        p.note.clone().unwrap_or_default(),
        p.created_at.clone(),
    ]
}

#[tauri::command]
pub async fn get_payments(state: State<'_, AppState>) -> Result<Vec<Payment>, String> {
    let sheets = get_sheets(&state).await?;
    let rows = sheets.get_all_rows(SHEET_PAYMENTS).await?;
    Ok(rows.into_iter().filter_map(row_to_payment).collect())
}

#[tauri::command]
pub async fn add_payment(
    state: State<'_, AppState>,
    data: PaymentInput,
) -> Result<Option<String>, String> {
    let sheets = get_sheets(&state).await?;

    // Deduplication: if this is an event payment (note contains "(event)"), skip duplicates
    if data.note.as_deref().map(|n| n.contains("(event)")).unwrap_or(false) {
        let rows = sheets.get_all_rows(SHEET_PAYMENTS).await?;
        let dup = rows.iter().any(|row| {
            row.get(1).map(|s| s.as_str()) == Some(&data.member_id)
                && row.get(2).map(|s| s.as_str()) == Some(&data.month)
                && row.get(6) == data.note.as_ref()
        });
        if dup { return Ok(None); }
    }

    let now = Utc::now().to_rfc3339();
    let id  = Uuid::new_v4().to_string();
    let payment = Payment {
        id: id.clone(),
        member_id: data.member_id,
        month:     data.month,
        amount:    data.amount,
        status:    data.status,
        paid_at:   data.paid_at,
        note:      data.note,
        created_at: now,
    };
    sheets.append_row(SHEET_PAYMENTS, payment_to_row(&payment)).await?;
    Ok(Some(id))
}

#[tauri::command]
pub async fn mark_payment_paid(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let sheets  = get_sheets(&state).await?;
    let row_idx = sheets.find_row_by_id(SHEET_PAYMENTS, &id).await?
        .ok_or_else(|| format!("Payment '{}' not found", id))?;
    let rows = sheets.get_all_rows(SHEET_PAYMENTS).await?;
    if let Some(mut row) = rows.into_iter().nth((row_idx - 1) as usize) {
        while row.len() < 8 { row.push(String::new()); }
        row[4] = "paid".to_string();
        row[5] = Utc::now().to_rfc3339();
        sheets.update_row(SHEET_PAYMENTS, row_idx, row).await?;
    }
    Ok(())
}

#[tauri::command]
pub async fn mark_payment_unpaid(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let sheets  = get_sheets(&state).await?;
    let row_idx = sheets.find_row_by_id(SHEET_PAYMENTS, &id).await?
        .ok_or_else(|| format!("Payment '{}' not found", id))?;
    let rows = sheets.get_all_rows(SHEET_PAYMENTS).await?;
    if let Some(mut row) = rows.into_iter().nth((row_idx - 1) as usize) {
        while row.len() < 8 { row.push(String::new()); }
        row[4] = "unpaid".to_string();
        row[5] = String::new();
        sheets.update_row(SHEET_PAYMENTS, row_idx, row).await?;
    }
    Ok(())
}
