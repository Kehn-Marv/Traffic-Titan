use actix_web::{delete, get, post, put, web, HttpResponse, Responder};
use rusqlite::params;

use crate::model::{Book, NewBook, UpdateBook};
use crate::util;

#[derive(Clone)]
pub struct AppState {
    pub db_path: String,
}

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(health)
        .service(list_books)
        .service(get_book)
        .service(create_book)
        .service(update_book)
        .service(delete_book);
}

// --- Health ---
#[get("/health")]
async fn health() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({ "status": "ok" }))
}

// --- List all books ---
#[get("/books")]
async fn list_books(state: web::Data<AppState>) -> impl Responder {
    // BASELINE (inefficient): open a new connection for every request
    let conn = match util::open_db(&state.db_path) {
        Ok(c) => c,
        Err(e) => return HttpResponse::InternalServerError().json(error_msg(e)),
    };

    let mut stmt = match conn.prepare("SELECT id, title, author, year FROM books ORDER BY id") {
        Ok(s) => s,
        Err(e) => return HttpResponse::InternalServerError().json(error_msg(e)),
    };

    let iter = match stmt.query_map([], |row| {
        Ok(Book {
            id: row.get(0)?,
            title: row.get(1)?,
            author: row.get(2)?,
            year: row.get(3)?,
        })
    }) {
        Ok(i) => i,
        Err(e) => return HttpResponse::InternalServerError().json(error_msg(e)),
    };

    let mut books = Vec::new();
    for b in iter {
        match b {
            Ok(book) => books.push(book),
            Err(e) => return HttpResponse::InternalServerError().json(error_msg(e)),
        }
    }

    HttpResponse::Ok().json(books)
}

// --- Get single book by id ---
#[get("/books/{id}")]
async fn get_book(state: web::Data<AppState>, path: web::Path<i64>) -> impl Responder {
    let id = path.into_inner();
    let conn = match util::open_db(&state.db_path) {
        Ok(c) => c,
        Err(e) => return HttpResponse::InternalServerError().json(error_msg(e)),
    };

    let mut stmt = match conn.prepare("SELECT id, title, author, year FROM books WHERE id = ?1") {
        Ok(s) => s,
        Err(e) => return HttpResponse::InternalServerError().json(error_msg(e)),
    };

    let result = stmt.query_row(params![id], |row| {
        Ok(Book {
            id: row.get(0)?,
            title: row.get(1)?,
            author: row.get(2)?,
            year: row.get(3)?,
        })
    });

    match result {
        Ok(book) => HttpResponse::Ok().json(book),
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            HttpResponse::NotFound().json(serde_json::json!({"error": "book not found"}))
        }
        Err(e) => HttpResponse::InternalServerError().json(error_msg(e)),
    }
}

// --- Create a new book ---
#[post("/books")]
async fn create_book(
    state: web::Data<AppState>,
    payload: web::Json<NewBook>,
) -> impl Responder {
    let conn = match util::open_db(&state.db_path) {
        Ok(c) => c,
        Err(e) => return HttpResponse::InternalServerError().json(error_msg(e)),
    };

    let mut stmt = match conn.prepare("INSERT INTO books (title, author, year) VALUES (?1, ?2, ?3)") {
        Ok(s) => s,
        Err(e) => return HttpResponse::InternalServerError().json(error_msg(e)),
    };

    match stmt.execute(params![payload.title, payload.author, payload.year]) {
        Ok(_) => {
            let id = conn.last_insert_rowid();
            HttpResponse::Created().json(serde_json::json!({ "id": id }))
        }
        Err(e) => HttpResponse::InternalServerError().json(error_msg(e)),
    }
}

// --- Update a book ---
#[put("/books/{id}")]
async fn update_book(
    state: web::Data<AppState>,
    path: web::Path<i64>,
    payload: web::Json<UpdateBook>,
) -> impl Responder {
    let id = path.into_inner();
    let conn = match util::open_db(&state.db_path) {
        Ok(c) => c,
        Err(e) => return HttpResponse::InternalServerError().json(error_msg(e)),
    };

    // Naive update: load existing, then update (extra queries on purpose in baseline)
    let exists = util::book_exists(&conn, id).unwrap_or(false);
    if !exists {
        return HttpResponse::NotFound().json(serde_json::json!({"error": "book not found"}));
    }

    let mut stmt = match conn.prepare("UPDATE books SET title = ?1, author = ?2, year = ?3 WHERE id = ?4") {
        Ok(s) => s,
        Err(e) => return HttpResponse::InternalServerError().json(error_msg(e)),
    };

    match stmt.execute(params![payload.title, payload.author, payload.year, id]) {
        Ok(affected) if affected == 1 => HttpResponse::Ok().json(serde_json::json!({"updated": id})),
        Ok(_) => HttpResponse::InternalServerError().json(serde_json::json!({"error": "unexpected affected rows"})),
        Err(e) => HttpResponse::InternalServerError().json(error_msg(e)),
    }
}

// --- Delete a book ---
#[delete("/books/{id}")]
async fn delete_book(state: web::Data<AppState>, path: web::Path<i64>) -> impl Responder {
    let id = path.into_inner();
    let conn = match util::open_db(&state.db_path) {
        Ok(c) => c,
        Err(e) => return HttpResponse::InternalServerError().json(error_msg(e)),
    };

    let mut stmt = match conn.prepare("DELETE FROM books WHERE id = ?1") {
        Ok(s) => s,
        Err(e) => return HttpResponse::InternalServerError().json(error_msg(e)),
    };

    match stmt.execute(params![id]) {
        Ok(affected) if affected == 1 => HttpResponse::Ok().json(serde_json::json!({"deleted": id})),
        Ok(_) => HttpResponse::NotFound().json(serde_json::json!({"error": "book not found"})),
        Err(e) => HttpResponse::InternalServerError().json(error_msg(e)),
    }
}

// --- Helpers ---
fn error_msg<E: std::fmt::Display>(e: E) -> serde_json::Value {
    serde_json::json!({ "error": e.to_string() })
}
