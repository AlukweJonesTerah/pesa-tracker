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

  if (!groupId || !description || !Number.isFinite(amount) || amount <= 0) return;

  // Only members can add expenses to a group
  const membership = await sql`
    SELECT id FROM members WHERE group_id = ${groupId} AND user_id = ${userId}
  `;
  if (membership.length === 0) return;

  const amountCents = Math.round(amount * 100);
  await sql`
    INSERT INTO expenses (group_id, paid_by, description, amount_cents)
    VALUES (${groupId}, ${userId}, ${description}, ${amountCents})
  `;

  revalidatePath(`/groups/${groupId}`);
}
