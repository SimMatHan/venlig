-- Valgfri sync: en kopi af appens data, sendt fra telefonen, så Claude kan
-- læse den via MCP (/mcp). Kun telefonen skriver; serveren ændrer aldrig noget.
CREATE TABLE records (
  collection TEXT NOT NULL,   -- checkins, habits, entries, books, settings, valueReflections
  id TEXT NOT NULL,           -- postens primærnøgle i appen
  data TEXT NOT NULL,         -- JSON
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (collection, id)
);

CREATE TABLE sync_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
