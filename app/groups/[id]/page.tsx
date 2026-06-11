import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { sql, type Expense, type Member, type Settlement } from "@/lib/db";
import {
  addExpense,
  deleteExpense,
  recordSettlement,
  leaveGroup,
} from "@/app/actions";
import {
  computeBalances,
  computeTransfers,
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

  const [groupRows, members, expenses, settlements] = await Promise.all([
    sql`SELECT id, name, code, created_by FROM groups WHERE id = ${groupId}`,
    sql`SELECT * FROM members WHERE group_id = ${groupId} ORDER BY name` as unknown as Promise<Member[]>,
    sql`
      SELECT e.*,
             COALESCE(
               array_agg(ep.user_id) FILTER (WHERE ep.user_id IS NOT NULL),
               '{}'
             ) AS participant_ids
      FROM expenses e
      LEFT JOIN expense_participants ep ON ep.expense_id = e.id
      WHERE e.group_id = ${groupId}
      GROUP BY e.id
      ORDER BY e.created_at DESC
    ` as unknown as Promise<Expense[]>,
    sql`
      SELECT * FROM settlements
      WHERE group_id = ${groupId}
      ORDER BY created_at DESC
    ` as unknown as Promise<Settlement[]>,
  ]);
  if (groupRows.length === 0) notFound();
  const group = groupRows[0];
  const isCreator = group.created_by === userId;

  const nameOf = new Map(members.map((m) => [m.user_id, m.name]));
  const balances = computeBalances(members, expenses, settlements);
  const transfers = computeTransfers(balances);
  const totalCents = expenses.reduce((s, e) => s + e.amount_cents, 0);

  // Pre-fill the settle-up form with what YOU owe, if anything
  const myTransfer = transfers.find((t) => t.fromId === userId);

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
            <fieldset className="participants">
              <legend>Split between</legend>
              {members.map((m) => (
                <label key={m.user_id} className="check">
                  <input
                    type="checkbox"
                    name="participants"
                    value={m.user_id}
                    defaultChecked
                  />
                  {m.name}
                  {m.user_id === userId && <span className="muted"> (you)</span>}
                </label>
              ))}
            </fieldset>
            <button className="btn" type="submit">
              Add expense
            </button>
          </form>
        </div>

        <div className="card">
          <h2>Who pays whom</h2>
          {transfers.length === 0 ? (
            <p className="all-square">Everyone is square 🎉</p>
          ) : (
            transfers.map((t, i) => (
              <div className="settle" key={i}>
                {t.fromName} <span className="arrow">→</span> {t.toName}
                <span className="amount">{formatKES(t.amountCents)}</span>
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

          <h2 style={{ marginTop: 22 }}>Settle up</h2>
          <form action={recordSettlement}>
            <input type="hidden" name="groupId" value={groupId} />
            <div>
              <label htmlFor="toUser">I paid</label>
              <select id="toUser" name="toUser" required defaultValue={myTransfer?.toId ?? ""}>
                <option value="" disabled>
                  Choose a member…
                </option>
                {members
                  .filter((m) => m.user_id !== userId)
                  .map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label htmlFor="settle-amount">Amount (KES)</label>
              <input
                id="settle-amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                defaultValue={
                  myTransfer ? (myTransfer.amountCents / 100).toFixed(2) : ""
                }
                required
              />
            </div>
            <button className="btn btn-outline" type="submit">
              Record payment
            </button>
          </form>
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
                <th>Split</th>
                <th>Date</th>
                <th style={{ textAlign: "right" }}>Amount</th>
                <th aria-label="Actions"></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => {
                const canDelete = e.paid_by === userId || isCreator;
                return (
                  <tr key={e.id}>
                    <td>{e.description}</td>
                    <td>{nameOf.get(e.paid_by) ?? "Former member"}</td>
                    <td className="muted">
                      {e.participant_ids.length === members.length
                        ? "everyone"
                        : `${e.participant_ids.length} of ${members.length}`}
                    </td>
                    <td className="date">
                      {new Date(e.created_at).toLocaleDateString("en-KE", {
                        day: "numeric",
                        month: "short",
                      })}
                    </td>
                    <td className="amount">{formatKES(e.amount_cents)}</td>
                    <td>
                      {canDelete && (
                        <form action={deleteExpense}>
                          <input type="hidden" name="expenseId" value={e.id} />
                          <input type="hidden" name="groupId" value={groupId} />
                          <button
                            className="btn-delete"
                            type="submit"
                            aria-label={`Delete ${e.description}`}
                          >
                            Delete
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {settlements.length > 0 && (
        <div className="card section-gap">
          <h2>Payment history</h2>
          <table className="ledger">
            <thead>
              <tr>
                <th>From</th>
                <th>To</th>
                <th>Date</th>
                <th style={{ textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {settlements.map((s) => (
                <tr key={s.id}>
                  <td>{nameOf.get(s.from_user) ?? "Former member"}</td>
                  <td>{nameOf.get(s.to_user) ?? "Former member"}</td>
                  <td className="date">
                    {new Date(s.created_at).toLocaleDateString("en-KE", {
                      day: "numeric",
                      month: "short",
                    })}
                  </td>
                  <td className="amount">{formatKES(s.amount_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="section-gap" style={{ textAlign: "right" }}>
        <form action={leaveGroup}>
          <input type="hidden" name="groupId" value={groupId} />
          <button className="btn-leave" type="submit">
            Leave this group
          </button>
        </form>
      </div>
    </>
  );
}
