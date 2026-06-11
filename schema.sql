-- Pesa Tracker v2 — FULL schema for a FRESH database.
-- (Upgrading from v1? Run migration-v1-to-v2.sql instead.)

CREATE TABLE IF NOT EXISTS groups (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS members (
  id SERIAL PRIMARY KEY,
  group_id INT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  UNIQUE (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  group_id INT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  paid_by TEXT NOT NULL,
  description TEXT NOT NULL,
  amount_cents INT NOT NULL CHECK (amount_cents > 0),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- v2: who shares each expense (equal split among these people)
CREATE TABLE IF NOT EXISTS expense_participants (
  expense_id INT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  PRIMARY KEY (expense_id, user_id)
);

-- v2: recorded "I paid you back" payments between members
CREATE TABLE IF NOT EXISTS settlements (
  id SERIAL PRIMARY KEY,
  group_id INT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  from_user TEXT NOT NULL,
  to_user TEXT NOT NULL,
  amount_cents INT NOT NULL CHECK (amount_cents > 0),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_members_user ON members(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_group ON expenses(group_id);
CREATE INDEX IF NOT EXISTS idx_participants_expense ON expense_participants(expense_id);
CREATE INDEX IF NOT EXISTS idx_settlements_group ON settlements(group_id);
