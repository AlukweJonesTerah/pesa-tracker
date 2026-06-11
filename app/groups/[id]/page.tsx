import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { sql, type Expense, type Member } from "@/lib/db";
import { addExpense } from "@/app/actions";
import {
  computeBalances,
  computeSettlements,
  formatKES,
} from "@/lib/balances";

export const dynamic = "force-dynamic";

export default async function GroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isInteger(groupId)) notFound();

  // Membership gate: you only see groups you belong to
  const membership = await sql`
    SELECT id FROM members WHERE group_id = ${groupId} AND user_id = ${userId}
  `;
  if (membership.length === 0) notFound();

  const [groupRows, members, expenses] = await Promise.all([
    sql`SELECT id, name, code FROM groups WHERE id = ${groupId}`,
    sql`SELECT * FROM members WHERE group_id = ${groupId} ORDER BY name` as Promise<Member[]>,
    sql`SELECT * FROM expenses WHERE group_id = ${groupId} ORDER BY created_at DESC` as Promise<Expense[]>,
  ]);
  if (groupRows.length === 0) notFound();
  const group = groupRows[0];

  const nameOf = new Map(members.map((m) => [m.user_id, m.name]));
  const balances = computeBalances(members, expenses);
  const settlements = computeSettlements(balances);
  const totalCents = expenses.reduce((s, e) => s + e.amount_cents, 0);

  return (
    <>
      <div className="page-head">
        <h1>{group.name}</h1>
        <span>
          <span className="muted">invite code </span>
          <span className="code-pill">{group.code}</span>
        </span>
      </div>
      <p className="muted" style={{ marginTop: -12 }}>
        {members.length} member{members.length !== 1 && "s"} ·{" "}
        {expenses.length} expense{expenses.length !== 1 && "s"} · total{" "}
        {formatKES(totalCents)}
      </p>

      <div className="grid-2 section-gap">
        <div className="card">
          <h2>Add an expense</h2>
          <form action={addExpense}>
            <input type="hidden" name="groupId" value={groupId} />
            <div>
              <label htmlFor="description">What was it?</label>
              <input
                id="description"
                name="description"
                type="text"
                placeholder="Nyama choma for everyone"
                required
                maxLength={120}
              />
            </div>
            <div>
              <label htmlFor="amount">Amount (KES)</label>
              <input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="2400"
                required
              />
            </div>
            <button className="btn" type="submit">
              Add expense
            </button>
          </form>
        </div>

        <div className="card">
          <h2>Who pays whom</h2>
          {settlements.length === 0 ? (
            <p className="all-square">Everyone is square 🎉</p>
          ) : (
            settlements.map((s, i) => (
              <div className="settle" key={i}>
                {s.fromName} <span className="arrow">→</span> {s.toName}
                <span className="amount">{formatKES(s.amountCents)}</span>
              </div>
            ))
          )}

          <h2 style={{ marginTop: 22 }}>Balances</h2>
          {balances.map((b) => (
            <div className="balance-row" key={b.userId}>
              <span>
                {b.name}
                {b.userId === userId && <span className="muted"> (you)</span>}
              </span>
              <span className={`net ${b.netCents >= 0 ? "pos" : "neg"}`}>
                {b.netCents >= 0 ? "+" : "−"}
                {formatKES(Math.abs(b.netCents))}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="card section-gap">
        <h2>Ledger</h2>
        {expenses.length === 0 ? (
          <p className="empty">
            Nothing logged yet. Add the first expense above.
          </p>
        ) : (
          <table className="ledger">
            <thead>
              <tr>
                <th>Description</th>
                <th>Paid by</th>
                <th>Date</th>
                <th style={{ textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id}>
                  <td>{e.description}</td>
                  <td>{nameOf.get(e.paid_by) ?? "Former member"}</td>
                  <td className="date">
                    {new Date(e.created_at).toLocaleDateString("en-KE", {
                      day: "numeric",
                      month: "short",
                    })}
                  </td>
                  <td className="amount">{formatKES(e.amount_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
