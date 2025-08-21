use actix_web::{delete, get, post, put, web, HttpResponse, Responder};
use moka::future::Cache;
use sqlx::Row;
use std::sync::Arc;
use crate::model::{Book, NewBook, UpdateBook};
use sqlx::SqlitePool;
use serde_json::json;

#[derive(Clone)]
pub struct AppState {
    pub pool: SqlitePool,
    // cache for list_books: key is a simple string (we only have one list variant here)
    pub list_cache: Arc<Cache<String, Vec<Book>>>,
}

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(health)
        .service(list_books)
        .service(get_book)
        .service(create_book)
        .service(update_book)
        .service(delete_book);
}

#[get("/health")]
async fn health() -> impl Responder {
    HttpResponse::Ok().json(json!({ "status": "ok" }))
}

#[get("/books")]
async fn list_books(state: web::Data<AppState>) -> impl Responder {
    let cache_key = "books_all".to_string();
    // Try cache first (very fast)
    if let Some(cached) = state.list_cache.get(&cache_key) {
        return HttpResponse::Ok().json(cached);
    }

    // Not in cache -> query DB asynchronously
    let rows = match sqlx::query("SELECT id, title, author, year FROM books ORDER BY id")
        .fetch_all(&state.pool)
        .await
    {
        Ok(r) => r,
        Err(e) => {
            return HttpResponse::InternalServerError().json(error_msg(e));
        }
    };

    let books: Vec<Book> = rows
        .into_iter()
        .map(|row| Book {
            id: row.get::<i64, _>("id"),
            title: row.get::<String, _>("title"),
            author: row.get::<String, _>("author"),
            year: row.get::<i32, _>("year"),
        })
        .collect();

    // populate cache with TTL 5 seconds (reduces DB pressure under bursty traffic)
    let _ = state
        .list_cache
        .insert(cache_key.clone(), books.clone())
        .await;
    

    HttpResponse::Ok().json(books)
}

#[get("/books/{id}")]
async fn get_book(state: web::Data<AppState>, path: web::Path<i64>) -> impl Responder {
    let id = path.into_inner();
    let row = match sqlx::query("SELECT id, title, author, year FROM books WHERE id = ?")
        .bind(id)
        .fetch_optional(&state.pool)
        .await
    {
        Ok(r) => r,
        Err(e) => return HttpResponse::InternalServerError().json(error_msg(e)),
    };

    match row {
        Some(r) => {
            let book = Book {
                id: r.get::<i64, _>("id"),
                title: r.get::<String, _>("title"),
                author: r.get::<String, _>("author"),
                year: r.get::<i32, _>("year"),
            };
            HttpResponse::Ok().json(book)
        }
        None => HttpResponse::NotFound().json(json!({"error":"book not found"})),
    }
}

#[post("/books")]
async fn create_book(
    state: web::Data<AppState>,
    payload: web::Json<NewBook>,
) -> impl Responder {
    let result = sqlx::query("INSERT INTO books (title, author, year) VALUES (?, ?, ?)")
        .bind(&payload.title)
        .bind(&payload.author)
        .bind(payload.year)
        .execute(&state.pool)
        .await;

    match result {
        Ok(res) => {
            let id = res.last_insert_rowid();
            // invalidate list cache quickly to ensure next list fetches new data
            let _ = state.list_cache.invalidate(&"books_all".to_string()).await;
            HttpResponse::Created().json(json!({ "id": id }))
        }
        Err(e) => HttpResponse::InternalServerError().json(error_msg(e)),
    }
}

#[put("/books/{id}")]
async fn update_book(
    state: web::Data<AppState>,
    path: web::Path<i64>,
    payload: web::Json<UpdateBook>,
) -> impl Responder {
    let id = path.into_inner();
    // Single UPDATE statement (no extra existence check)
    let result = sqlx::query("UPDATE books SET title = ?, author = ?, year = ? WHERE id = ?")
        .bind(&payload.title)
        .bind(&payload.author)
        .bind(payload.year)
        .bind(id)
        .execute(&state.pool)
        .await;

    match result {
        Ok(res) if res.rows_affected() == 1 => {
            let _ = state.list_cache.invalidate(&"books_all".to_string()).await;
            HttpResponse::Ok().json(json!({"updated": id}))
        }
        Ok(_) => HttpResponse::NotFound().json(json!({"error":"book not found"})),
        Err(e) => HttpResponse::InternalServerError().json(error_msg(e)),
    }
}

#[delete("/books/{id}")]
async fn delete_book(state: web::Data<AppState>, path: web::Path<i64>) -> impl Responder {
    let id = path.into_inner();
    let result = sqlx::query("DELETE FROM books WHERE id = ?")
        .bind(id)
        .execute(&state.pool)
        .await;

    match result {
        Ok(res) if res.rows_affected() == 1 => {
            let _ = state.list_cache.invalidate(&"books_all".to_string()).await;
            HttpResponse::Ok().json(json!({"deleted": id}))
        }
        Ok(_) => HttpResponse::NotFound().json(json!({"error":"book not found"})),
        Err(e) => HttpResponse::InternalServerError().json(error_msg(e)),
    }
}

fn error_msg<E: std::fmt::Display>(e: E) -> serde_json::Value {
    json!({ "error": e.to_string() })
}
