use rusqlite::{Connection, Result};

pub fn init_db(db_path: &str) -> Result<()> {
    let conn = Connection::open(db_path)?;
    conn.execute_batch(
        r#"
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS books (
            id     INTEGER PRIMARY KEY AUTOINCREMENT,
            title  TEXT NOT NULL,
            author TEXT NOT NULL,
            year   INTEGER NOT NULL
        );
        "#,
    )?;
    Ok(())
}

// BASELINE: no pooling; every request opens a connection (inefficient).
pub fn open_db(db_path: &str) -> Result<Connection> {
    Connection::open(db_path)
}

// Small helper used by update_book (extra query on purpose in baseline)
pub fn book_exists(conn: &Connection, id: i64) -> Result<bool> {
    let mut stmt = conn.prepare("SELECT 1 FROM books WHERE id = ?1")?;
    let exists = stmt.exists([id])?;
    Ok(exists)
}
