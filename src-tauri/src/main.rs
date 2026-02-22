use active_win_pos_rs::get_active_window;
use rusqlite::{Connection, params};
use std::{thread, time::Duration, path::PathBuf};
use chrono::{Utc, Local, NaiveDate, Datelike};
use tauri::Manager;
use serde::{Serialize, Deserialize};
use anyhow::{Result, Context};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[allow(dead_code)]
struct Event {
    id: i64,
    timestamp: String,
    app: String,
    title: String,
    tags: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct AppStats {
    app: String,
    count: i64,
    first_seen: String,
    last_seen: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct SearchResult {
    id: i64,
    timestamp: String,
    app: String,
    title: String,
    tags: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[allow(dead_code)]
struct Config {
    blacklist: Vec<String>,
}

fn get_db_path(app: &tauri::AppHandle) -> Result<PathBuf> {
    let mut path = app
        .path()
        .app_data_dir()
        .context("Failed to get app data dir")?;
    
    std::fs::create_dir_all(&path)
        .context("Failed to create app data directory")?;
    
    path.push("memory.db");
    Ok(path)
}

fn init_db(app: &tauri::AppHandle) -> Result<Connection> {
    let path = get_db_path(app)?;
    let conn = Connection::open(path)
        .context("Failed to open database")?;

    // Main events table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            app TEXT NOT NULL,
            title TEXT NOT NULL,
            tags TEXT
        )",
        [],
    ).context("Failed to create events table")?;

    // Migration: Add tags column if it doesn't exist
    conn.execute(
        "ALTER TABLE events ADD COLUMN tags TEXT",
        [],
    ).ok(); // Ignore error if column already exists

    // FTS5 virtual table for full-text search
    conn.execute(
        "CREATE VIRTUAL TABLE IF NOT EXISTS events_fts USING fts5(
            app, title, content='events', content_rowid='id'
        )",
        [],
    ).context("Failed to create FTS table")?;

    // Triggers to keep FTS in sync
    conn.execute(
        "CREATE TRIGGER IF NOT EXISTS events_ai AFTER INSERT ON events BEGIN
            INSERT INTO events_fts(rowid, app, title) VALUES (new.id, new.app, new.title);
        END",
        [],
    ).ok();

    conn.execute(
        "CREATE TRIGGER IF NOT EXISTS events_ad AFTER DELETE ON events BEGIN
            INSERT INTO events_fts(events_fts, rowid, app, title) VALUES('delete', old.id, old.app, old.title);
        END",
        [],
    ).ok();

    conn.execute(
        "CREATE TRIGGER IF NOT EXISTS events_au AFTER UPDATE ON events BEGIN
            INSERT INTO events_fts(events_fts, rowid, app, title) VALUES('delete', old.id, old.app, old.title);
            INSERT INTO events_fts(rowid, app, title) VALUES (new.id, new.app, new.title);
        END",
        [],
    ).ok();

    // Config table for blacklist
    conn.execute(
        "CREATE TABLE IF NOT EXISTS config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        [],
    ).context("Failed to create config table")?;

    // Index for faster queries
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_timestamp ON events(timestamp)",
        [],
    ).ok();

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_app ON events(app)",
        [],
    ).ok();

    Ok(conn)
}

fn load_blacklist(conn: &Connection) -> Vec<String> {
    conn.query_row(
        "SELECT value FROM config WHERE key = 'blacklist'",
        [],
        |row| row.get::<_, String>(0)
    )
    .ok()
    .and_then(|json| serde_json::from_str(&json).ok())
    .unwrap_or_default()
}

fn start_logger(app: tauri::AppHandle) {
    thread::spawn(move || {
        let conn = match init_db(&app) {
            Ok(c) => c,
            Err(e) => {
                eprintln!("Failed to init DB: {}", e);
                return;
            }
        };

        let mut last_app = String::new();
        let mut last_title = String::new();

        loop {
            let blacklist = load_blacklist(&conn);

            if let Ok(win) = get_active_window() {
                let app_name = win.app_name;
                let title = win.title;

                // Check blacklist
                if blacklist.iter().any(|b| app_name.to_lowercase().contains(&b.to_lowercase())) {
                    thread::sleep(Duration::from_secs(2));
                    continue;
                }

                if app_name != last_app || title != last_title {
                    let now = Utc::now().to_rfc3339();

                    conn.execute(
                        "INSERT INTO events (timestamp, app, title) VALUES (?1, ?2, ?3)",
                        params![now, app_name, title],
                    ).ok();

                    last_app = app_name;
                    last_title = title;
                }
            }

            thread::sleep(Duration::from_secs(2));
        }
    });
}

fn parse_date_query(query: &str) -> Option<(String, Option<String>)> {
    let lower = query.to_lowercase();
    let now = Local::now();

    if lower.contains("today") {
        let start = now.date_naive().and_hms_opt(0, 0, 0)?.and_local_timezone(Local).single()?;
        return Some((start.to_rfc3339(), None));
    }

    if lower.contains("yesterday") {
        let yesterday = now.date_naive().pred_opt()?;
        let start = yesterday.and_hms_opt(0, 0, 0)?.and_local_timezone(Local).single()?;
        let end = yesterday.and_hms_opt(23, 59, 59)?.and_local_timezone(Local).single()?;
        return Some((start.to_rfc3339(), Some(end.to_rfc3339())));
    }

    if lower.contains("last hour") {
        let start = now - chrono::Duration::hours(1);
        return Some((start.to_rfc3339(), None));
    }

    if lower.contains("last 24 hours") {
        let start = now - chrono::Duration::hours(24);
        return Some((start.to_rfc3339(), None));
    }

    if lower.contains("this week") {
        let weekday = now.weekday().num_days_from_monday();
        let start_of_week = now.date_naive() - chrono::Duration::days(weekday as i64);
        let start = start_of_week.and_hms_opt(0, 0, 0)?.and_local_timezone(Local).single()?;
        return Some((start.to_rfc3339(), None));
    }

    if lower.contains("last week") {
        let weekday = now.weekday().num_days_from_monday();
        let start_of_last_week = now.date_naive() - chrono::Duration::days(weekday as i64 + 7);
        let end_of_last_week = start_of_last_week + chrono::Duration::days(6);
        let start = start_of_last_week.and_hms_opt(0, 0, 0)?.and_local_timezone(Local).single()?;
        let end = end_of_last_week.and_hms_opt(23, 59, 59)?.and_local_timezone(Local).single()?;
        return Some((start.to_rfc3339(), Some(end.to_rfc3339())));
    }

    // Parse "after:YYYY-MM-DD" or "before:YYYY-MM-DD"
    if let Some(after_idx) = lower.find("after:") {
        let date_str = &query[after_idx + 6..].split_whitespace().next()?;
        if let Ok(date) = NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
            let start = date.and_hms_opt(0, 0, 0)?.and_local_timezone(Local).single()?;
            return Some((start.to_rfc3339(), None));
        }
    }

    if let Some(before_idx) = lower.find("before:") {
        let date_str = &query[before_idx + 7..].split_whitespace().next()?;
        if let Ok(date) = NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
            let end = date.and_hms_opt(23, 59, 59)?.and_local_timezone(Local).single()?;
            return Some((String::new(), Some(end.to_rfc3339())));
        }
    }

    None
}

#[tauri::command]
fn search_memories(app: tauri::AppHandle, query: String) -> Result<Vec<SearchResult>, String> {
    let path = get_db_path(&app).map_err(|e| e.to_string())?;
    let conn = Connection::open(path).map_err(|e| e.to_string())?;

    let lower = query.to_lowercase();
    let words: Vec<&str> = lower.split_whitespace().collect();

    // Handle "after <app/title>" query
    if words.len() >= 2 && words[0] == "after" {
        let target = words[1..].join(" ");
        let pattern = format!("%{}%", target);

        let id_result: Result<i64, _> = conn.query_row(
            "SELECT id FROM events 
             WHERE app LIKE ?1 OR title LIKE ?1 
             ORDER BY id DESC LIMIT 1",
            [pattern],
            |row| row.get(0)
        );

        if let Ok(id) = id_result {
            let mut stmt = conn.prepare(
                "SELECT id, timestamp, app, title, tags
                 FROM events 
                 WHERE id > ?1 
                 ORDER BY id ASC 
                 LIMIT 50"
            ).map_err(|e| e.to_string())?;

            let results = stmt
                .query_map([id], |row| {
                    Ok(SearchResult {
                        id: row.get(0)?,
                        timestamp: row.get(1)?,
                        app: row.get(2)?,
                        title: row.get(3)?,
                        tags: row.get(4)?,
                    })
                })
                .map_err(|e| e.to_string())?
                .filter_map(Result::ok)
                .collect();

            return Ok(results);
        }
    }

    // Handle date-based queries
    if let Some((start, end)) = parse_date_query(&query) {
        let mut stmt = if let Some(_end_time) = &end {
            let sql = "SELECT id, timestamp, app, title, tags
                       FROM events
                       WHERE timestamp >= ?1 AND timestamp <= ?2
                       ORDER BY id DESC
                       LIMIT 100";
            conn.prepare(sql).map_err(|e| e.to_string())?
        } else if !start.is_empty() {
            let sql = "SELECT id, timestamp, app, title, tags
                       FROM events
                       WHERE timestamp >= ?1
                       ORDER BY id DESC
                       LIMIT 100";
            conn.prepare(sql).map_err(|e| e.to_string())?
        } else {
            let sql = "SELECT id, timestamp, app, title, tags
                       FROM events
                       WHERE timestamp <= ?1
                       ORDER BY id DESC
                       LIMIT 100";
            conn.prepare(sql).map_err(|e| e.to_string())?
        };

        let results = if let Some(end_time) = end {
            stmt.query_map(params![start, end_time], |row| {
                Ok(SearchResult {
                    id: row.get(0)?,
                    timestamp: row.get(1)?,
                    app: row.get(2)?,
                    title: row.get(3)?,
                    tags: row.get(4)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(Result::ok)
            .collect()
        } else {
            stmt.query_map([start], |row| {
                Ok(SearchResult {
                    id: row.get(0)?,
                    timestamp: row.get(1)?,
                    app: row.get(2)?,
                    title: row.get(3)?,
                    tags: row.get(4)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(Result::ok)
            .collect()
        };

        return Ok(results);
    }

    // Use FTS5 for full-text search
    let pattern = query.split_whitespace().collect::<Vec<_>>().join(" OR ");
    
    let mut stmt = conn.prepare(
        "SELECT e.id, e.timestamp, e.app, e.title, e.tags
         FROM events e
         JOIN events_fts ON events_fts.rowid = e.id
         WHERE events_fts MATCH ?1
         ORDER BY e.id DESC
         LIMIT 100"
    ).map_err(|e| e.to_string())?;

    let results = stmt
        .query_map([pattern], |row| {
            Ok(SearchResult {
                id: row.get(0)?,
                timestamp: row.get(1)?,
                app: row.get(2)?,
                title: row.get(3)?,
                tags: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(Result::ok)
        .collect();

    Ok(results)
}

#[tauri::command]
fn get_statistics(app: tauri::AppHandle) -> Result<Vec<AppStats>, String> {
    let path = get_db_path(&app).map_err(|e| e.to_string())?;
    let conn = Connection::open(path).map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT app, COUNT(*) as count, MIN(timestamp) as first_seen, MAX(timestamp) as last_seen
         FROM events
         GROUP BY app
         ORDER BY count DESC
         LIMIT 20"
    ).map_err(|e| e.to_string())?;

    let results = stmt
        .query_map([], |row| {
            Ok(AppStats {
                app: row.get(0)?,
                count: row.get(1)?,
                first_seen: row.get(2)?,
                last_seen: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(Result::ok)
        .collect();

    Ok(results)
}

#[tauri::command]
fn export_to_csv(app: tauri::AppHandle, query: String) -> Result<String, String> {
    let results = search_memories(app, query)?;
    
    let mut wtr = csv::Writer::from_writer(vec![]);
    wtr.write_record(&["ID", "Timestamp", "App", "Title", "Tags"])
        .map_err(|e| e.to_string())?;

    for result in results {
        wtr.write_record(&[
            result.id.to_string(),
            result.timestamp,
            result.app,
            result.title,
            result.tags.unwrap_or_default(),
        ])
        .map_err(|e| e.to_string())?;
    }

    let data = String::from_utf8(wtr.into_inner().map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;

    Ok(data)
}

#[tauri::command]
fn add_tag(app: tauri::AppHandle, event_id: i64, tag: String) -> Result<(), String> {
    let path = get_db_path(&app).map_err(|e| e.to_string())?;
    let conn = Connection::open(path).map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE events SET tags = ?1 WHERE id = ?2",
        params![tag, event_id],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn get_blacklist(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let path = get_db_path(&app).map_err(|e| e.to_string())?;
    let conn = Connection::open(path).map_err(|e| e.to_string())?;
    Ok(load_blacklist(&conn))
}

#[tauri::command]
fn update_blacklist(app: tauri::AppHandle, blacklist: Vec<String>) -> Result<(), String> {
    let path = get_db_path(&app).map_err(|e| e.to_string())?;
    let conn = Connection::open(path).map_err(|e| e.to_string())?;

    let json = serde_json::to_string(&blacklist).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT OR REPLACE INTO config (key, value) VALUES ('blacklist', ?1)",
        [json],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn get_recent_searches(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let path = get_db_path(&app).map_err(|e| e.to_string())?;
    let conn = Connection::open(path).map_err(|e| e.to_string())?;

    let result: Result<String, _> = conn.query_row(
        "SELECT value FROM config WHERE key = 'recent_searches'",
        [],
        |row| row.get(0)
    );

    match result {
        Ok(json) => serde_json::from_str(&json).map_err(|e| e.to_string()),
        Err(_) => Ok(vec![]),
    }
}

#[tauri::command]
fn save_recent_search(app: tauri::AppHandle, query: String) -> Result<(), String> {
    let path = get_db_path(&app).map_err(|e| e.to_string())?;
    let conn = Connection::open(path).map_err(|e| e.to_string())?;

    let mut recent: Vec<String> = get_recent_searches(app.clone()).unwrap_or_default();
    
    // Remove if exists and add to front
    recent.retain(|q| q != &query);
    recent.insert(0, query);
    recent.truncate(10); // Keep only last 10

    let json = serde_json::to_string(&recent).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT OR REPLACE INTO config (key, value) VALUES ('recent_searches', ?1)",
        [json],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn get_timeline(app: tauri::AppHandle, date: String) -> Result<Vec<SearchResult>, String> {
    let path = get_db_path(&app).map_err(|e| e.to_string())?;
    let conn = Connection::open(path).map_err(|e| e.to_string())?;

    let start = format!("{}T00:00:00", date);
    let end = format!("{}T23:59:59", date);

    let mut stmt = conn.prepare(
        "SELECT id, timestamp, app, title, tags
         FROM events
         WHERE timestamp >= ?1 AND timestamp <= ?2
         ORDER BY id ASC"
    ).map_err(|e| e.to_string())?;

    let results = stmt
        .query_map(params![start, end], |row| {
            Ok(SearchResult {
                id: row.get(0)?,
                timestamp: row.get(1)?,
                app: row.get(2)?,
                title: row.get(3)?,
                tags: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(Result::ok)
        .collect();

    Ok(results)
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            search_memories,
            get_statistics,
            export_to_csv,
            add_tag,
            get_blacklist,
            update_blacklist,
            get_recent_searches,
            save_recent_search,
            get_timeline
        ])
        .setup(|app| {
            start_logger(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
