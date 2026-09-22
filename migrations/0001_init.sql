CREATE TABLE IF NOT EXISTS records (
  workspace TEXT NOT NULL,
  entity TEXT NOT NULL,
  record_id TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  payload TEXT NOT NULL,
  PRIMARY KEY (workspace, entity, record_id)
);
CREATE INDEX IF NOT EXISTS idx_records_workspace ON records(workspace, updated_at);
