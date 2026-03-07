-- Add debug reports table for tracker UI field-level flags (run against existing DB)
CREATE TABLE IF NOT EXISTS fantasy_fc_debug_reports (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL DEFAULT 'player',
  entity_key VARCHAR(255) NOT NULL,
  field_path VARCHAR(255) NOT NULL,
  rendered_value TEXT,
  schema_group VARCHAR(50) NOT NULL,
  comment TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  page_context JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_debug_reports_status ON fantasy_fc_debug_reports(status);
CREATE INDEX IF NOT EXISTS idx_debug_reports_entity ON fantasy_fc_debug_reports(entity_type, entity_key);
