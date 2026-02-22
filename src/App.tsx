import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

interface SearchResult {
  id: number;
  timestamp: string;
  app: string;
  title: string;
  tags: string | null;
}

interface AppStats {
  app: string;
  count: number;
  first_seen: string;
  last_seen: string;
}

function App() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [view, setView] = useState<"search" | "stats" | "timeline" | "settings">("search");
  const [stats, setStats] = useState<AppStats[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const [newBlacklistItem, setNewBlacklistItem] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [timelineData, setTimelineData] = useState<SearchResult[]>([]);
  const [tagInput, setTagInput] = useState<{ [key: number]: string }>({});

  useEffect(() => {
    loadRecentSearches();
    if (view === "settings") {
      loadBlacklist();
    }
  }, [view]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("search-input")?.focus();
      }
    };

    globalThis.addEventListener("keydown", handleKeyDown);
    return () => globalThis.removeEventListener("keydown", handleKeyDown);
  }, []);

  const loadRecentSearches = async () => {
    try {
      const recent = await invoke<string[]>("get_recent_searches");
      setRecentSearches(recent);
    } catch (err) {
      console.error("Failed to load recent searches:", err);
    }
  };

  const loadBlacklist = async () => {
    try {
      const list = await invoke<string[]>("get_blacklist");
      setBlacklist(list);
    } catch (err) {
      console.error("Failed to load blacklist:", err);
    }
  };

  const search = async () => {
    if (!query.trim()) return;

    setLoading(true);
    try {
      const res = await invoke<SearchResult[]>("search_memories", { query });
      setResults(res);
      await invoke("save_recent_search", { query });
      await loadRecentSearches();
    } catch (err) {
      console.error("Search failed:", err);
      alert("Search failed: " + err);
    } finally {
      setLoading(false);
      setShowSuggestions(false);
    }
  };

  const loadStats = async () => {
    setLoading(true);
    try {
      const statsData = await invoke<AppStats[]>("get_statistics");
      setStats(statsData);
    } catch (err) {
      console.error("Failed to load stats:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadTimeline = async () => {
    setLoading(true);
    try {
      const data = await invoke<SearchResult[]>("get_timeline", { date: selectedDate });
      setTimelineData(data);
    } catch (err) {
      console.error("Failed to load timeline:", err);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = async () => {
    try {
      const csv = await invoke<string>("export_to_csv", { query });
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `memory-export-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
      alert("Export failed: " + err);
    }
  };

  const addTag = async (eventId: number) => {
    const tag = tagInput[eventId];
    if (!tag) return;

    try {
      await invoke("add_tag", { eventId, tag });
      alert("Tag added!");
      setTagInput({ ...tagInput, [eventId]: "" });
      search(); // Refresh results
    } catch (err) {
      console.error("Failed to add tag:", err);
      alert("Failed to add tag: " + err);
    }
  };

  const addToBlacklist = async () => {
    if (!newBlacklistItem.trim()) return;

    const updated = [...blacklist, newBlacklistItem.trim()];
    try {
      await invoke("update_blacklist", { blacklist: updated });
      setBlacklist(updated);
      setNewBlacklistItem("");
    } catch (err) {
      console.error("Failed to update blacklist:", err);
      alert("Failed to update blacklist: " + err);
    }
  };

  const removeFromBlacklist = async (item: string) => {
    const updated = blacklist.filter(b => b !== item);
    try {
      await invoke("update_blacklist", { blacklist: updated });
      setBlacklist(updated);
    } catch (err) {
      console.error("Failed to update blacklist:", err);
    }
  };

  const formatRelativeTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  const highlightText = (text: string, query: string): React.ReactElement => {
    if (!query.trim()) return <>{text}</>;
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <>
        {parts.map((part, i) => {
          const isMatch = part.toLowerCase() === query.toLowerCase();
          const markStyle = { 
            background: darkMode ? "#ffd700" : "#ffeb3b", 
            padding: "2px 4px", 
            borderRadius: "3px" 
          };
          const key = `${part}-${i}-${Math.random()}`;
          return isMatch ? 
            <mark key={key} style={markStyle}>{part}</mark> : 
            <span key={key}>{part}</span>;
        })}
      </>
    );
  };

  useEffect(() => {
    if (view === "stats") {
      loadStats();
    } else if (view === "timeline") {
      loadTimeline();
    }
  }, [view, selectedDate]);

  const containerStyle: React.CSSProperties = {
    padding: 30,
    fontFamily: "system-ui, -apple-system, sans-serif",
    background: darkMode ? "#1a1a1a" : "#ffffff",
    color: darkMode ? "#e0e0e0" : "#000000",
    minHeight: "100vh",
    transition: "all 0.3s ease"
  };

  return (
    <div style={containerStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>🧠 Memory Search</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setView("search")} style={buttonStyle(view === "search", darkMode)}>
            Search
          </button>
          <button onClick={() => setView("stats")} style={buttonStyle(view === "stats", darkMode)}>
            Stats
          </button>
          <button onClick={() => setView("timeline")} style={buttonStyle(view === "timeline", darkMode)}>
            Timeline
          </button>
          <button onClick={() => setView("settings")} style={buttonStyle(view === "settings", darkMode)}>
            Settings
          </button>
          <button onClick={() => setDarkMode(!darkMode)} style={buttonStyle(false, darkMode)}>
            {darkMode ? "☀️" : "🌙"}
          </button>
        </div>
      </div>

      {view === "search" && (
        <>
          <div style={{ position: "relative" }}>
            <input
              id="search-input"
              style={inputStyle(darkMode)}
              placeholder="What do you remember? (Ctrl/Cmd+K)"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggestions(e.target.value.length === 0);
              }}
              onFocus={() => setShowSuggestions(query.length === 0)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              onKeyDown={(e) => e.key === "Enter" && search()}
            />
            
            {showSuggestions && recentSearches.length > 0 && (
              <div style={suggestionsStyle(darkMode)}>
                <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 8 }}>Recent searches:</div>
                {recentSearches.map((s) => (
                  <button
                    key={s}
                    type="button"
                    style={{ ...suggestionItemStyle(), width: "100%", textAlign: "left", border: "none" }}
                    onClick={() => {
                      setQuery(s);
                      setShowSuggestions(false);
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginTop: 10, fontSize: 13, opacity: 0.7 }}>
            Try: "today", "yesterday", "last hour", "after:2024-01-01", "after Chrome"
          </div>

          {results.length > 0 && (
            <button onClick={exportCSV} style={{ ...buttonStyle(false, darkMode), marginTop: 15 }}>
              📥 Export to CSV
            </button>
          )}

          {loading && (
            <div style={{ marginTop: 25, textAlign: "center" }}>
              <div style={spinnerStyle}>⏳</div>
              <div>Searching...</div>
            </div>
          )}

          {!loading && results.length === 0 && query && (
            <div style={{ marginTop: 50, textAlign: "center", opacity: 0.6 }}>
              <div style={{ fontSize: 48 }}>🔍</div>
              <div style={{ marginTop: 10 }}>No memories found</div>
              <div style={{ fontSize: 14, marginTop: 5 }}>Try a different search term</div>
            </div>
          )}

          <div style={{ marginTop: 25 }}>
            {results.map((r) => (
              <div key={`${r.id}-${r.timestamp}`} style={resultCardStyle(darkMode)}>
                <div style={{ fontWeight: 600, fontSize: 16 }}>
                  {highlightText(r.app, query)}
                </div>
                <div style={{ marginTop: 5 }}>
                  {highlightText(r.title, query)}
                </div>
                <div style={{ fontSize: 12, opacity: 0.6, marginTop: 8 }}>
                  {formatRelativeTime(r.timestamp)}
                </div>
                {r.tags && (
                  <div style={{ marginTop: 8, fontSize: 12, color: darkMode ? "#90caf9" : "#1976d2" }}>
                    🏷️ {r.tags}
                  </div>
                )}
                <div style={{ marginTop: 10, display: "flex", gap: 5 }}>
                  <input
                    type="text"
                    placeholder="Add tag..."
                    value={tagInput[r.id] || ""}
                    onChange={(e) => setTagInput({ ...tagInput, [r.id]: e.target.value })}
                    style={{ ...inputStyle(darkMode), fontSize: 12, padding: 6 }}
                  />
                  <button onClick={() => addTag(r.id)} style={smallButtonStyle(darkMode)}>
                    Add Tag
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {view === "stats" && (
        <div>
          <h2>📊 Application Statistics</h2>
          {loading ? (
            <div style={{ textAlign: "center", marginTop: 50 }}>
              <div style={spinnerStyle}>⏳</div>
              <div>Loading stats...</div>
            </div>
          ) : (
            <div style={{ marginTop: 20 }}>
              {stats.map((stat) => (
                <div key={stat.app} style={resultCardStyle(darkMode)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 16 }}>{stat.app}</div>
                      <div style={{ fontSize: 14, opacity: 0.7, marginTop: 5 }}>
                        {stat.count} events recorded
                      </div>
                    </div>
                    <div style={{ textAlign: "right", fontSize: 12, opacity: 0.6 }}>
                      <div>First: {formatRelativeTime(stat.first_seen)}</div>
                      <div>Last: {formatRelativeTime(stat.last_seen)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === "timeline" && (
        <div>
          <h2>📅 Timeline View</h2>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ ...inputStyle(darkMode), marginBottom: 20 }}
          />
          {loading ? (
            <div style={{ textAlign: "center", marginTop: 50 }}>
              <div style={spinnerStyle}>⏳</div>
              <div>Loading timeline...</div>
            </div>
          ) : timelineData.length === 0 ? (
            <div style={{ textAlign: "center", marginTop: 50, opacity: 0.6 }}>
              <div style={{ fontSize: 48 }}>📭</div>
              <div style={{ marginTop: 10 }}>No activity on this date</div>
            </div>
          ) : (
            <div style={{ marginTop: 20 }}>
              {timelineData.map((event) => (
                <div key={event.id} style={{ ...resultCardStyle(darkMode), position: "relative", paddingLeft: 40 }}>
                  <div style={{
                    position: "absolute",
                    left: 15,
                    top: 15,
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: darkMode ? "#90caf9" : "#1976d2"
                  }} />
                  <div style={{ fontSize: 12, opacity: 0.6 }}>
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </div>
                  <div style={{ fontWeight: 600, marginTop: 5 }}>{event.app}</div>
                  <div style={{ fontSize: 14, marginTop: 3 }}>{event.title}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === "settings" && (
        <div>
          <h2>⚙️ Settings</h2>
          
          <div style={{ marginTop: 30 }}>
            <h3>Privacy Blacklist</h3>
            <p style={{ fontSize: 14, opacity: 0.7 }}>
              Apps containing these keywords won't be logged
            </p>
            
            <div style={{ display: "flex", gap: 10, marginTop: 15 }}>
              <input
                type="text"
                placeholder="e.g., password, bank, private"
                value={newBlacklistItem}
                onChange={(e) => setNewBlacklistItem(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addToBlacklist()}
                style={{ ...inputStyle(darkMode), flex: 1 }}
              />
              <button onClick={addToBlacklist} style={buttonStyle(false, darkMode)}>
                Add
              </button>
            </div>

            <div style={{ marginTop: 20 }}>
              {blacklist.length === 0 ? (
                <div style={{ opacity: 0.5, fontStyle: "italic" }}>No blacklisted items</div>
              ) : (
                blacklist.map((item) => (
                  <div key={item} style={{
                    ...resultCardStyle(darkMode),
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}>
                    <span>{item}</span>
                    <button
                      onClick={() => removeFromBlacklist(item)}
                      style={{ ...smallButtonStyle(darkMode), background: "#f44336" }}
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const buttonStyle = (active: boolean, darkMode: boolean): React.CSSProperties => {
  const bgColor = active 
    ? (darkMode ? "#1976d2" : "#2196f3")
    : (darkMode ? "#333" : "#f0f0f0");
  const textColor = active 
    ? "#fff"
    : (darkMode ? "#e0e0e0" : "#000");
  
  return {
    padding: "8px 16px",
    borderRadius: 8,
    border: "none",
    background: bgColor,
    color: textColor,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 500,
    transition: "all 0.2s ease"
  };
};

const smallButtonStyle = (darkMode: boolean): React.CSSProperties => ({
  padding: "6px 12px",
  borderRadius: 6,
  border: "none",
  background: darkMode ? "#1976d2" : "#2196f3",
  color: "#fff",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 500
});

const inputStyle = (darkMode: boolean): React.CSSProperties => {
  const borderColor = darkMode ? "#444" : "#ccc";
  const bgColor = darkMode ? "#2a2a2a" : "#fff";
  const textColor = darkMode ? "#e0e0e0" : "#000";
  
  return {
    width: "100%",
    padding: 12,
    fontSize: 16,
    borderRadius: 10,
    border: `1px solid ${borderColor}`,
    background: bgColor,
    color: textColor,
    outline: "none",
    boxSizing: "border-box"
  };
};

const resultCardStyle = (darkMode: boolean): React.CSSProperties => {
  const bgColor = darkMode ? "#2a2a2a" : "#f9f9f9";
  const borderColor = darkMode ? "#333" : "#e0e0e0";
  
  return {
    padding: 15,
    marginBottom: 12,
    borderRadius: 10,
    background: bgColor,
    border: `1px solid ${borderColor}`,
    transition: "all 0.2s ease"
  };
};

const suggestionsStyle = (darkMode: boolean): React.CSSProperties => {
  const bgColor = darkMode ? "#2a2a2a" : "#fff";
  const borderColor = darkMode ? "#444" : "#ccc";
  
  return {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    marginTop: 5,
    padding: 10,
    borderRadius: 10,
    background: bgColor,
    border: `1px solid ${borderColor}`,
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    zIndex: 1000
  };
};

const suggestionItemStyle = (): React.CSSProperties => ({
  padding: 8,
  borderRadius: 6,
  cursor: "pointer",
  transition: "background 0.2s ease",
  background: "transparent"
});

const spinnerStyle: React.CSSProperties = {
  fontSize: 32,
  animation: "spin 1s linear infinite"
};

export default App;
