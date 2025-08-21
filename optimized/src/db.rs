use sqlx::{sqlite::SqlitePoolOptions, Pool, Sqlite};
use anyhow::Result;
use std::path::Path;


/// Initialize an async Sqlite pool and ensure schema exists.
/// Use WAL mode and a small pool size tuned for local development.
pub async fn init_pool(db_path: &str) -> Result<Pool<Sqlite>> {
    // Ensure folder exists (if path includes directories)
    if let Some(parent) = Path::new(db_path).parent() {
        if !parent.to_string_lossy().is_empty() {
            std::fs::create_dir_all(parent)?;
        }
    }

    // Create pool with a reasonable max connections (tunable)
    let pool = SqlitePoolOptions::new()
        .max_connections(8)            // tuned higher than baseline
        .connect(&format!("sqlite://{}?mode=rwc", db_path))
        .await?;

    // Activate WAL for concurrency
    sqlx::query("PRAGMA journal_mode = WAL;").execute(&pool).await?;

    // Create table if not exists
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS books (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            author TEXT NOT NULL,
            year INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_books_author ON books(author);
    "#,
    )
    .execute(&pool)
    .await?;

    Ok(pool)
}
