import { neon } from "@neondatabase/serverless";

// One serverless SQL client, reused everywhere.
// DATABASE_URL is auto-set by the Vercel ↔ Neon integration,
// or copy it from the Neon dashboard for local dev.
export const sql = neon(process.env.DATABASE_URL!);

export type Group = {
  id: number;
  name: string;
  code: string;
  created_by: string;
};

export type Member = {
  id: number;
  group_id: number;
  user_id: string;
  name: string;
};

export type Expense = {
  id: number;
  group_id: number;
  paid_by: string;
  description: string;
  amount_cents: number;
  created_at: string;
  participant_ids: string[]; // v2: aggregated from expense_participants
};

export type Settlement = {
  id: number;
  group_id: number;
  from_user: string;
  to_user: string;
  amount_cents: number;
  created_at: string;
};
