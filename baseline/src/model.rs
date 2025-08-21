use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Book {
    pub id: i64,
    pub title: String,
    pub author: String,
    pub year: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NewBook {
    pub title: String,
    pub author: String,
    pub year: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdateBook {
    pub title: String,
    pub author: String,
    pub year: i32,
}
