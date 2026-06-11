-- Run this once in the Neon SQL Editor (console.neon.tech → your project → SQL Editor)

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
  paid_by TEXT NOT NULL,          -- Clerk user id of the payer
  description TEXT NOT NULL,
  amount_cents INT NOT NULL CHECK (amount_cents > 0),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_members_user ON members(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_group ON expenses(group_id);
