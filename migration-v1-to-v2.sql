-- Pesa Tracker v1 → v2 migration.
-- Run this ONCE in the Neon SQL Editor if you already have v1 data.
-- Safe to keep your app running while you do it.

-- 1. New table: who shares each expense
CREATE TABLE IF NOT EXISTS expense_participants (
  expense_id INT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  PRIMARY KEY (expense_id, user_id)
);

-- 2. New table: recorded payments between members
CREATE TABLE IF NOT EXISTS settlements (
  id SERIAL PRIMARY KEY,
  group_id INT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  from_user TEXT NOT NULL,
  to_user TEXT NOT NULL,
  amount_cents INT NOT NULL CHECK (amount_cents > 0),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_participants_expense ON expense_participants(expense_id);
CREATE INDEX IF NOT EXISTS idx_settlements_group ON settlements(group_id);

-- 3. Backfill: v1 expenses were split among ALL group members,
--    so register every current member as a participant of every
--    existing expense in their group. Keeps old balances identical.
INSERT INTO expense_participants (expense_id, user_id)
SELECT e.id, m.user_id
FROM expenses e
JOIN members m ON m.group_id = e.group_id
ON CONFLICT DO NOTHING;
