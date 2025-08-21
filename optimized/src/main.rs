mod routes;
mod model;
mod db;

use actix_web::{web, App, HttpServer};
use routes::AppState;
use std::env;
use moka::future::Cache;
use std::sync::Arc;
use log::info;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));

    let db_path = env::var("DB_PATH").unwrap_or_else(|_| "optimized_books.db".to_string());
    let pool = match db::init_pool(&db_path).await {
        Ok(p) => p,
        Err(e) => {
            log::error!("DB init error: {:?}", e);
            panic!("failed to init db");
        }
    };

    // Moka cache with small capacity (we cache the whole books list here)
    let list_cache: Cache<String, Vec<model::Book>> = Cache::builder()
        .max_capacity(10)
        .time_to_live(std::time::Duration::from_secs(5))
        .build();

    let state = web::Data::new(AppState {
        pool,
        list_cache: Arc::new(list_cache),
    });

    info!("Starting optimized server at http://127.0.0.1:8081");
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .configure(routes::configure)
    })
    .bind(("127.0.0.1", 8081))?
    .workers(4) // tuned worker count; adjust for CPU/cores in real env
    .run()
    .await
}
