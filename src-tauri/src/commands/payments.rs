use chrono::Utc;
use tauri::State;
use uuid::Uuid;
use crate::{
    db,
    models::{Payment, PaymentInput},
    state::{with_db, AppState},
};

#[tauri::command]
pub fn get_payments(state: State<'_, AppState>) -> Result<Vec<Payment>, String> {
    with_db(&state, db::list_payments)
}

/// Returns `None` (without inserting) when an identical event payment already
/// exists for the same member + month — same dedup contract the frontend
/// relies on (DataContext treats a null id as "duplicate, skip").
#[tauri::command]
pub fn add_payment(state: State<'_, AppState>, data: PaymentInput) -> Result<Option<String>, String> {
    let is_event = data.note.as_deref().map(|n| n.contains("(event)")).unwrap_or(false);

    let now = Utc::now().to_rfc3339();
    let id = Uuid::new_v4().to_string();
    let payment = Payment {
        id: id.clone(),
        member_id: data.member_id,
        month: data.month,
        amount: data.amount,
        status: data.status,
        paid_at: data.paid_at,
        note: data.note,
        created_at: now,
    };

    let inserted = with_db(&state, |conn| {
        if is_event {
            let note = payment.note.as_deref().unwrap_or_default();
            if db::payment_duplicate_exists(conn, &payment.member_id, &payment.month, note)? {
                return Ok(false);
            }
        }
        db::insert_payment(conn, &payment)?;
        Ok(true)
    })?;

    if inserted {
        state.mirror.mark_dirty();
        Ok(Some(id))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn mark_payment_paid(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    with_db(&state, |conn| db::set_payment_status(conn, &id, "paid", Some(&now)))?;
    state.mirror.mark_dirty();
    Ok(())
}

#[tauri::command]
pub fn mark_payment_unpaid(state: State<'_, AppState>, id: String) -> Result<(), String> {
    with_db(&state, |conn| db::set_payment_status(conn, &id, "unpaid", None))?;
    state.mirror.mark_dirty();
    Ok(())
}
