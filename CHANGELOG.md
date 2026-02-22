# Changelog

## Version 2.0.0 - Complete Overhaul (2024)

### 🎉 Major Features Added

#### Backend Improvements
- ✅ Proper error handling with `anyhow` and `Result` types
- ✅ Full-text search using SQLite FTS5 for blazing-fast queries
- ✅ Date range filtering (`after:YYYY-MM-DD`, `before:YYYY-MM-DD`)
- ✅ Natural language time queries (today, yesterday, last hour, this week, etc.)
- ✅ Application statistics with usage counts and timestamps
- ✅ CSV export functionality for search results
- ✅ Privacy blacklist to exclude sensitive apps from logging
- ✅ Tag system for categorizing important events
- ✅ Recent searches tracking (last 10 queries)
- ✅ Timeline view for day-by-day activity browsing
- ✅ Context search ("after Chrome" finds what happened after Chrome)
- ✅ Database indexing for faster queries

#### Frontend Improvements
- ✅ Fixed React key warnings (unique keys for all lists)
- ✅ Search suggestions showing recent queries
- ✅ Relative time formatting ("2 hours ago" instead of timestamps)
- ✅ Multi-view interface (Search, Stats, Timeline, Settings)
- ✅ Dark mode with smooth transitions
- ✅ Keyboard shortcuts (Ctrl/Cmd+K to focus search)
- ✅ Loading states with animated spinners
- ✅ Empty states with helpful messages
- ✅ Search term highlighting in results
- ✅ Timeline visualization with date picker
- ✅ Inline tag management
- ✅ One-click CSV export
- ✅ Blacklist management UI
- ✅ Responsive card-based design
- ✅ Accessibility improvements (ARIA roles, keyboard navigation)

### 🔧 Technical Improvements

#### Database
- Added FTS5 virtual table for full-text search
- Added triggers to keep FTS index in sync
- Added config table for settings storage
- Added indexes on timestamp and app columns
- Added tags column to events table

#### Dependencies Added
- `anyhow` - Better error handling
- `csv` - CSV export functionality
- `chrono::Datelike` - Date manipulation for time queries

#### Code Quality
- Removed all `.unwrap()` calls
- Proper error propagation throughout
- Type-safe Tauri commands
- No compilation warnings
- Clean TypeScript with proper types
- Accessibility-compliant UI components

### 📊 New Commands

#### Tauri Commands
- `search_memories` - Enhanced with FTS5 and date parsing
- `get_statistics` - Application usage statistics
- `export_to_csv` - Export search results to CSV
- `add_tag` - Tag events for categorization
- `get_blacklist` - Retrieve privacy blacklist
- `update_blacklist` - Modify privacy blacklist
- `get_recent_searches` - Get recent search history
- `save_recent_search` - Save a search query
- `get_timeline` - Get events for a specific date

### 🎨 UI/UX Enhancements

#### New Views
- **Search View**: Enhanced with suggestions and highlights
- **Stats View**: Application usage dashboard
- **Timeline View**: Day-by-day activity browser
- **Settings View**: Privacy controls and configuration

#### Design System
- Consistent color scheme for light/dark modes
- Smooth transitions and animations
- Hover effects on interactive elements
- Proper spacing and typography
- Accessible color contrasts

### 🔒 Privacy Features
- Blacklist system to exclude sensitive apps
- All data stored locally (no cloud sync)
- Full user control over logged data
- Easy blacklist management in settings

### 📝 Documentation
- Comprehensive README with usage examples
- FEATURES.md detailing all implemented features
- Inline code comments
- Query syntax examples in UI

### 🐛 Bug Fixes
- Fixed unclosed delimiter in search function
- Fixed React key warnings
- Fixed TypeScript compilation errors
- Fixed Rust compilation warnings
- Fixed accessibility issues

### ⚡ Performance
- FTS5 provides sub-millisecond search
- Indexed database queries
- Efficient date parsing
- Background logging doesn't block UI
- Optimized React re-renders

### 🔄 Breaking Changes
- Database schema updated (automatic migration on first run)
- New Tauri commands (old API removed)
- Updated frontend component structure

---

## Version 1.0.0 - Initial Release

### Features
- Basic activity logging
- Simple search functionality
- SQLite storage
- React frontend
- Tauri desktop app

### Known Issues
- No error handling
- Limited search capabilities
- No date filtering
- No statistics
- No privacy controls
