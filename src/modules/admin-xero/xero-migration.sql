-- Xero integration tables
-- Run this migration on your PostgreSQL database

-- Table to store Xero OAuth tokens (single row, id=1)
CREATE TABLE IF NOT EXISTS xero_tokens (
  id INTEGER PRIMARY KEY DEFAULT 1,
  tenant_id VARCHAR(255) NOT NULL,
  token_data JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT single_row CHECK (id = 1)
);

-- Table to track which orders have been synced to Xero
CREATE TABLE IF NOT EXISTS xero_invoice_sync (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL UNIQUE,
  xero_invoice_id VARCHAR(255) NOT NULL,
  xero_invoice_number VARCHAR(100),
  xero_contact_id VARCHAR(255),
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_xero_invoice_sync_order_id ON xero_invoice_sync(order_id);
