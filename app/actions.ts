"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";

function makeCode(): string {
  // 6-char join code, no ambiguous characters (0/O, 1/I)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

async function requireUser() {
  const { userId } = await auth();
  if (!userId) redirect("/");
  const user = await currentUser();
  const name =
    user?.firstName ||
    user?.username ||
    user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] ||
    "Member";
  return { userId, name };
}

async function requireMembership(groupId: number, userId: string) {
  const rows = await sql`
    SELECT id FROM members WHERE group_id = ${groupId} AND user_id = ${userId}
  `;
  return rows.length > 0;
}

export async function createGroup(formData: FormData) {
  const { userId, name } = await requireUser();
  const groupName = String(formData.get("name") || "").trim();
  if (!groupName) return;

  const code = makeCode();
  const rows = await sql`
    INSERT INTO groups (name, code, created_by)
    VALUES (${groupName}, ${code}, ${userId})
    RETURNING id
  `;
  const groupId = rows[0].id as number;

  await sql`
    INSERT INTO members (group_id, user_id, name)
    VALUES (${groupId}, ${userId}, ${name})
    ON CONFLICT (group_id, user_id) DO NOTHING
  `;

  redirect(`/groups/${groupId}`);
}

export async function joinGroup(formData: FormData) {
  const { userId, name } = await requireUser();
  const code = String(formData.get("code") || "").trim().toUpperCase();
  if (!code) return;

  const rows = await sql`SELECT id FROM groups WHERE code = ${code}`;
  if (rows.length === 0) {
    redirect("/dashboard?error=code");
  }
  const groupId = rows[0].id as number;

  await sql`
    INSERT INTO members (group_id, user_id, name)
    VALUES (${groupId}, ${userId}, ${name})
    ON CONFLICT (group_id, user_id) DO NOTHING
  `;

  redirect(`/groups/${groupId}`);
}

export async function addExpense(formData: FormData) {
  const { userId } = await requireUser();
  const groupId = Number(formData.get("groupId"));
  const description = String(formData.get("description") || "").trim();
  const amount = Number(formData.get("amount"));
  const participants = formData.getAll("participants").map(String);

  if (!groupId || !description || !Number.isFinite(amount) || amount <= 0) return;
  if (participants.length === 0) return;
  if (!(await requireMembership(groupId, userId))) return;

  // Only accept participants who are real members of this group
  const memberRows = await sql`
    SELECT user_id FROM members WHERE group_id = ${groupId}
  `;
  const memberIds = new Set(memberRows.map((r) => r.user_id as string));
  const validParticipants = participants.filter((p) => memberIds.has(p));
  if (validParticipants.length === 0) return;

  const amountCents = Math.round(amount * 100);
  const inserted = await sql`
    INSERT INTO expenses (group_id, paid_by, description, amount_cents)
    VALUES (${groupId}, ${userId}, ${description}, ${amountCents})
    RETURNING id
  `;
  const expenseId = inserted[0].id as number;

  for (const p of validParticipants) {
    await sql`
      INSERT INTO expense_participants (expense_id, user_id)
      VALUES (${expenseId}, ${p})
      ON CONFLICT DO NOTHING
    `;
  }

  revalidatePath(`/groups/${groupId}`);
}

export async function deleteExpense(formData: FormData) {
  const { userId } = await requireUser();
  const expenseId = Number(formData.get("expenseId"));
  const groupId = Number(formData.get("groupId"));
  if (!expenseId || !groupId) return;

  // Only the person who paid, or the group creator, can delete
  await sql`
    DELETE FROM expenses e
    USING groups g
    WHERE e.id = ${expenseId}
      AND e.group_id = ${groupId}
      AND g.id = e.group_id
      AND (e.paid_by = ${userId} OR g.created_by = ${userId})
  `;

  revalidatePath(`/groups/${groupId}`);
}

export async function recordSettlement(formData: FormData) {
  const { userId } = await requireUser();
  const groupId = Number(formData.get("groupId"));
  const toUser = String(formData.get("toUser") || "");
  const amount = Number(formData.get("amount"));

  if (!groupId || !toUser || !Number.isFinite(amount) || amount <= 0) return;
  if (toUser === userId) return;
  if (!(await requireMembership(groupId, userId))) return;
  if (!(await requireMembership(groupId, toUser))) return;

  const amountCents = Math.round(amount * 100);
  await sql`
    INSERT INTO settlements (group_id, from_user, to_user, amount_cents)
    VALUES (${groupId}, ${userId}, ${toUser}, ${amountCents})
  `;

  revalidatePath(`/groups/${groupId}`);
}

export async function leaveGroup(formData: FormData) {
  const { userId } = await requireUser();
  const groupId = Number(formData.get("groupId"));
  if (!groupId) return;

  // Block leaving with an unsettled balance is a v3 nicety;
  // for now anyone can leave, their past expenses stay on record.
  await sql`
    DELETE FROM members WHERE group_id = ${groupId} AND user_id = ${userId}
  `;

  redirect("/dashboard");
}
