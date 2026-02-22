# Memory Search - Complete Project Documentation

## Project Overview

Memory Search is a desktop application that automatically tracks your computer activity and provides a powerful search interface to recall what you were working on at any point in time. Think of it as a "time machine" for your digital life - it remembers every application and window you've used, allowing you to search through your activity history with natural language queries.

## Problem Statement

Have you ever tried to remember:
- What website you were looking at last Tuesday?
- When you last worked on a specific project?
- What you were doing before a meeting?
- Which apps you use most frequently?

Memory Search solves this by creating a searchable timeline of your computer activity, making it easy to recall past work and understand your productivity patterns.

## Technical Architecture

### Technology Stack

**Backend (Rust)**
- **Tauri 2.0**: Cross-platform desktop framework
- **SQLite**: Local database with FTS5 full-text search
- **rusqlite**: Rust SQLite bindings
- **chrono**: Date and time manipulation
- **active-win-pos-rs**: Window activity tracking
- **anyhow**: Error handling
- **serde/serde_json**: Serialization
- **csv**: CSV export functionality

**Frontend (React + TypeScript)**
- **React 19**: UI framework
- **TypeScript**: Type-safe JavaScript
- **Vite**: Build tool and dev server
- **Tauri API**: Frontend-backend communication

### System Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Desktop App (Tauri)               │
├─────────────────────────────────────────────────────┤
│  Frontend (React)          │  Backend (Rust)        │
│  ├─ Search Interface       │  ├─ Activity Logger    │
│  ├─ Statistics View        │  ├─ Database Manager   │
│  ├─ Timeline View          │  ├─ Search Engine      │
│  ├─ Settings Panel         │  ├─ Query Parser       │
│  └─ Dark Mode              │  └─ Export Handler     │
├─────────────────────────────────────────────────────┤
│              SQLite Database (Local)                │
│  ├─ events table (activity logs)                    │
│  ├─ events_fts (FTS5 search index)                  │
│  └─ config table (settings)                         │
└─────────────────────────────────────────────────────┘
```

## Core Features

### 1. Automatic Activity Tracking
- Monitors active window every 2 seconds
- Captures application name and window title
- Stores with precise timestamps
- Runs in background thread (non-blocking)
- Respects privacy blacklist

### 2. Advanced Search Capabilities

**Full-Text Search (FTS5)**
- Lightning-fast search across millions of events
- Searches both app names and window titles
- Multi-word queries with OR logic
- Sub-millisecond response times

**Natural Language Time Queries**
- `today` - All activity from today
- `yesterday` - Previous day's activity
- `last hour` - Past 60 minutes
- `last 24 hours` - Past day
- `this week` - Current week
- `last week` - Previous week

**Date Range Filtering**
- `after:2024-01-01` - Events after date
- `before:2024-12-31` - Events before date
- Combined: `after:2024-01-01 before:2024-01-31`

**Context Search**
- `after Chrome` - Find what happened after using Chrome
- `after meeting` - Activity following a meeting
- Useful for reconstructing work sessions

### 3. Statistics Dashboard
- Top 20 most-used applications
- Event count per application
- First and last seen timestamps
- Usage patterns visualization
- Helps understand productivity habits

### 4. Timeline View
- Day-by-day activity browser
- Date picker for any historical date
- Chronological event list
- Visual timeline with timestamps
- Perfect for reviewing past work

### 5. Privacy Controls
- Blacklist sensitive applications
- Keyword-based filtering
- Case-insensitive matching
- Apps matching blacklist aren't logged
- Examples: password managers, banking apps

### 6. Tag System
- Manually tag important events
- Categorize work sessions
- Search by tags later
- Inline tag management in results

### 7. Export Functionality
- Export search results to CSV
- Includes all fields (ID, timestamp, app, title, tags)
- One-click download
- Compatible with Excel, Google Sheets

### 8. Modern UI/UX

**Dark Mode**
- Toggle between light and dark themes
- Smooth transitions
- Proper contrast ratios
- Consistent styling

**Keyboard Shortcuts**
- `Ctrl/Cmd + K` - Focus search from anywhere
- `Enter` - Execute search
- Full keyboard navigation

**Smart Features**
- Recent search suggestions
- Relative time display ("2 hours ago")
- Search term highlighting
- Loading states with animations
- Empty states with helpful messages

## Database Schema

### Events Table
```sql
CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    app TEXT NOT NULL,
    title TEXT NOT NULL,
    tags TEXT
);

-- Indexes for performance
CREATE INDEX idx_timestamp ON events(timestamp);
CREATE INDEX idx_app ON events(app);
```

### FTS5 Search Index
```sql
CREATE VIRTUAL TABLE events_fts USING fts5(
    app, title, 
    content='events', 
    content_rowid='id'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER events_ai AFTER INSERT ON events BEGIN
    INSERT INTO events_fts(rowid, app, title) 
    VALUES (new.id, new.app, new.title);
END;

CREATE TRIGGER events_ad AFTER DELETE ON events BEGIN
    INSERT INTO events_fts(events_fts, rowid, app, title) 
    VALUES('delete', old.id, old.app, old.title);
END;

CREATE TRIGGER events_au AFTER UPDATE ON events BEGIN
    INSERT INTO events_fts(events_fts, rowid, app, title) 
    VALUES('delete', old.id, old.app, old.title);
    INSERT INTO events_fts(rowid, app, title) 
    VALUES (new.id, new.app, new.title);
END;
```

### Config Table
```sql
CREATE TABLE config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Stores:
-- - blacklist (JSON array)
-- - recent_searches (JSON array)
```

## Implementation Details

### Backend Components

**1. Activity Logger (`start_logger`)**
- Spawns background thread
- Polls active window every 2 seconds
- Checks against blacklist
- Inserts new events into database
- Tracks state to avoid duplicate entries

**2. Query Parser (`parse_date_query`)**
- Parses natural language time queries
- Converts to ISO 8601 timestamps
- Handles date arithmetic
- Returns start/end timestamp ranges

**3. Search Engine (`search_memories`)**
- Handles multiple query types
- Uses FTS5 for text search
- Applies date filters
- Supports context search
- Returns structured results

**4. Statistics Generator (`get_statistics`)**
- Aggregates events by application
- Counts occurrences
- Finds first/last timestamps
- Sorts by frequency

**5. Export Handler (`export_to_csv`)**
- Converts search results to CSV
- Proper escaping and formatting
- Returns as string for download

**6. Privacy Manager**
- `get_blacklist` - Retrieves blacklist
- `update_blacklist` - Modifies blacklist
- Stored as JSON in config table

### Frontend Components

**1. Search View**
- Main search interface
- Recent search suggestions
- Result cards with highlighting
- Inline tag management
- Export button

**2. Stats View**
- Application usage dashboard
- Sorted by frequency
- Timestamp ranges
- Clean card layout

**3. Timeline View**
- Date picker
- Chronological event list
- Visual timeline dots
- Time-of-day display

**4. Settings View**
- Blacklist management
- Add/remove keywords
- Real-time updates

**5. Theme System**
- Dark/light mode toggle
- CSS-in-JS styling
- Smooth transitions
- Consistent color palette

## Performance Optimizations

### Database
- FTS5 provides sub-millisecond search
- Indexed columns (timestamp, app)
- Efficient query planning
- Automatic index maintenance via triggers

### Backend
- Background logging thread
- Non-blocking operations
- Proper error handling (no panics)
- Efficient date parsing

### Frontend
- React hooks for state management
- Debounced search input
- Lazy loading of results
- Optimized re-renders

## Security & Privacy

### Data Storage
- All data stored locally in SQLite
- No cloud sync or external connections
- Database location: 
  - Windows: `%APPDATA%\memory-search\memory.db`
  - macOS: `~/Library/Application Support/memory-search/memory.db`
  - Linux: `~/.local/share/memory-search/memory.db`

### Privacy Features
- Blacklist for sensitive apps
- User controls what gets logged
- No telemetry or analytics
- Open source (auditable)

### Permissions
- Requires accessibility permissions (macOS)
- Window monitoring access
- Local file system access only

## Error Handling

### Backend
- All functions return `Result<T, E>`
- Using `anyhow` for error context
- Errors propagated to frontend as strings
- No `.unwrap()` calls in production code

### Frontend
- Try-catch blocks around async operations
- User-friendly error messages
- Graceful degradation
- Loading states prevent race conditions

## Build & Deployment

### Development
```bash
npm install
npm run tauri dev
```

### Production Build
```bash
npm run tauri build
```

### Output
- Windows: `.exe` installer
- macOS: `.dmg` and `.app`
- Linux: `.deb`, `.AppImage`

## Configuration

### Adjustable Parameters (in code)

**Backend (`main.rs`)**
- Polling interval: `Duration::from_secs(2)`
- Search result limit: `LIMIT 100`
- Stats limit: `LIMIT 20`
- Recent searches: `truncate(10)`

**Frontend (`App.tsx`)**
- Theme colors
- Card styling
- Animation durations

## Use Cases

### Personal Productivity
- Track time spent on projects
- Understand work patterns
- Find when you worked on something
- Productivity insights

### Work Reconstruction
- "What was I doing before the meeting?"
- "When did I last work on this?"
- "What website had that information?"

### Time Tracking
- See which apps you use most
- Identify time sinks
- Optimize workflow

### Research & Development
- Track research sessions
- Find previously visited resources
- Reconstruct thought processes

## Future Enhancement Possibilities

### Not Yet Implemented
- Screenshot capture with events
- OCR for screenshot text search
- Browser extension integration
- Automatic project categorization
- Productivity reports and insights
- Cloud backup (optional)
- Mobile companion app
- Smart suggestions based on patterns
- Context reconstruction AI
- Time tracking per project

## Technical Challenges Solved

### 1. Cross-Platform Window Tracking
- Used `active-win-pos-rs` for consistent API
- Handles different OS window managers
- Reliable polling mechanism

### 2. Fast Search at Scale
- FTS5 handles millions of events
- Proper indexing strategy
- Efficient query planning

### 3. Date Query Parsing
- Natural language to SQL conversion
- Timezone handling with chrono
- Flexible query syntax

### 4. Real-Time UI Updates
- React state management
- Async Tauri commands
- Loading states

### 5. Database Migrations
- ALTER TABLE for schema changes
- Backward compatibility
- Graceful error handling

## Code Quality

### Standards
- TypeScript strict mode
- Rust clippy lints
- No compilation warnings
- Proper error handling throughout

### Testing
- Manual testing of all features
- Cross-platform verification
- Performance benchmarking

### Documentation
- Inline code comments
- README with examples
- Feature documentation
- Changelog

## Project Statistics

- **Lines of Code**: ~1,500 (Rust + TypeScript)
- **Dependencies**: 15 major packages
- **Build Time**: ~2 minutes (release)
- **Binary Size**: ~10MB (compressed)
- **Supported Platforms**: Windows, macOS, Linux

## Conclusion

Memory Search is a production-ready desktop application that solves the problem of digital memory loss. By automatically tracking and indexing computer activity, it provides a powerful search interface for recalling past work. The combination of Rust's performance and safety with React's modern UI capabilities creates a fast, reliable, and user-friendly experience.

The project demonstrates:
- Full-stack desktop development with Tauri
- Advanced SQLite features (FTS5, triggers)
- Modern React patterns and TypeScript
- Cross-platform compatibility
- Privacy-first design
- Production-quality error handling
- Comprehensive feature set

All code is well-structured, documented, and ready for further development or deployment.
