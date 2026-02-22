# 🧠 Memory Search

A powerful desktop application that automatically tracks your digital activity and lets you search through your computer usage history. Built with Tauri, React, and Rust.

## Features

### Core Functionality
- **Automatic Activity Logging**: Tracks active windows and applications every 2 seconds
- **Full-Text Search**: Fast FTS5-powered search across all your activity
- **Smart Query Parsing**: Natural language queries like "today", "yesterday", "last hour"
- **Date Range Filtering**: Search with "after:2024-01-01" or "before:2024-12-31"
- **Context Search**: Find what happened "after Chrome" or "after meeting"

### Advanced Features
- **Statistics Dashboard**: See your most-used apps and time patterns
- **Timeline View**: Visualize your activity hour-by-hour for any date
- **Tags & Categories**: Manually tag important moments for easy retrieval
- **Export to CSV**: Export search results for external analysis
- **Privacy Controls**: Blacklist apps you don't want tracked
- **Recent Searches**: Quick access to your previous queries
- **Dark Mode**: Easy on the eyes for night owls

### UI/UX
- **Keyboard Shortcuts**: Ctrl/Cmd+K to focus search
- **Search Suggestions**: Recent searches appear as you type
- **Relative Time**: "2 hours ago" instead of timestamps
- **Highlight Matches**: Search terms highlighted in results
- **Loading States**: Visual feedback during operations
- **Responsive Design**: Clean, modern interface

## Installation

### Prerequisites
- Node.js (v16+)
- Rust (latest stable)
- npm or yarn

### Setup

1. Clone the repository
```bash
git clone <your-repo>
cd memory-search
```

2. Install dependencies
```bash
npm install
```

3. Run in development mode
```bash
npm run tauri dev
```

4. Build for production
```bash
npm run tauri build
```

## Usage

### Search Queries

**Basic Search**
```
chrome
meeting notes
slack conversation
```

**Time-Based Queries**
```
today
yesterday
last hour
last 24 hours
this week
last week
```

**Date Range Queries**
```
after:2024-01-01
before:2024-12-31
after:2024-01-01 before:2024-01-31
```

**Context Queries**
```
after Chrome
after Slack
after meeting
```

### Privacy & Blacklist

Add keywords to the blacklist to prevent certain apps from being logged:
1. Go to Settings tab
2. Add keywords (e.g., "password", "bank", "private")
3. Any app containing these keywords won't be tracked

### Exporting Data

1. Perform a search
2. Click "Export to CSV"
3. Save the file to analyze in Excel, Google Sheets, etc.

### Tags

Add tags to important events:
1. Find an event in search results
2. Type a tag in the input field
3. Click "Add Tag"
4. Search by tag later

## Architecture

### Backend (Rust)
- **Database**: SQLite with FTS5 for full-text search
- **Activity Tracking**: Uses `active-win-pos-rs` to monitor active windows
- **Error Handling**: Proper Result types with anyhow
- **Performance**: Indexed queries, efficient FTS5 search

### Frontend (React + TypeScript)
- **State Management**: React hooks
- **Styling**: Inline styles with theme support
- **API Communication**: Tauri invoke commands
- **Accessibility**: Keyboard navigation, proper ARIA roles

## Database Schema

```sql
-- Main events table
CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    app TEXT NOT NULL,
    title TEXT NOT NULL,
    tags TEXT
);

-- FTS5 virtual table for search
CREATE VIRTUAL TABLE events_fts USING fts5(
    app, title, content='events', content_rowid='id'
);

-- Configuration storage
CREATE TABLE config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```

## Development

### Project Structure
```
memory-search/
├── src/                    # React frontend
│   ├── App.tsx            # Main component
│   ├── App.css            # Styles
│   └── main.tsx           # Entry point
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── main.rs        # Tauri commands & logic
│   │   └── lib.rs         # Library exports
│   ├── Cargo.toml         # Rust dependencies
│   └── tauri.conf.json    # Tauri configuration
└── package.json           # Node dependencies
```

### Adding New Features

1. **Backend Command**: Add to `src-tauri/src/main.rs`
```rust
#[tauri::command]
fn my_command(app: tauri::AppHandle) -> Result<String, String> {
    // Your logic here
    Ok("Success".to_string())
}

// Register in main()
.invoke_handler(tauri::generate_handler![my_command])
```

2. **Frontend Integration**: Call from React
```typescript
const result = await invoke<string>("my_command");
```

## Performance Tips

- Database is indexed on timestamp and app for fast queries
- FTS5 provides near-instant full-text search
- Activity logging runs in a separate thread
- UI updates are debounced to prevent lag

## Privacy & Security

- All data stored locally in SQLite database
- No cloud sync or external connections
- Blacklist feature for sensitive apps
- Database location: `~/.local/share/memory-search/` (Linux/Mac) or `%APPDATA%/memory-search/` (Windows)

## Troubleshooting

**App not tracking activity**
- Check if the app has accessibility permissions (macOS)
- Verify the logger thread is running

**Search not working**
- Rebuild FTS5 index: Delete database and restart
- Check for SQL syntax errors in queries

**High CPU usage**
- Increase polling interval in `start_logger()` (default: 2 seconds)

## Future Enhancements

- [ ] Screenshot capture with OCR
- [ ] Productivity insights and reports
- [ ] Smart suggestions based on patterns
- [ ] Context reconstruction ("What was I doing when...")
- [ ] Cloud backup (optional)
- [ ] Mobile companion app

## License

MIT

## Contributing

Pull requests welcome! Please ensure:
- Code passes `cargo clippy` and `cargo fmt`
- TypeScript has no errors
- New features include documentation

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Backend**: Rust, Tauri 2.0
- **Database**: SQLite with FTS5
- **Activity Tracking**: active-win-pos-rs
- **Date/Time**: chrono
- **Serialization**: serde, serde_json
- **CSV Export**: csv crate
