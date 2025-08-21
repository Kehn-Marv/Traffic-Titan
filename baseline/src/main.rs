mod routes;
mod model;
mod util;

use actix_web::{web, App, HttpServer};
use routes::AppState;
use std::env;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Simple logging (RUST_LOG=info cargo run)
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));

    // You can override the DB file with: DB_PATH=/path/to/file.db
    let db_path = env::var("DB_PATH").unwrap_or_else(|_| "books.db".to_string());

    // Ensure DB & tables exist
    util::init_db(&db_path).expect("failed to initialize SQLite database");

    let state = web::Data::new(AppState { db_path });

    log::info!("Starting baseline server at http://127.0.0.1:8080");
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .configure(routes::configure)
    })
    .bind(("127.0.0.1", 8080))?
    .run()
    .await
}
