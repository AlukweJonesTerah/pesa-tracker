import type { Expense, Member, Settlement } from "./db";

export type Balance = {
  userId: string;
  name: string;
  paidCents: number;   // expenses paid + settlements sent
  shareCents: number;  // their share of expenses + settlements received
  netCents: number;    // positive = is owed money, negative = owes money
};

export type Transfer = {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amountCents: number;
};

/**
 * v2 balance model:
 * - each expense is split equally among ITS participants only
 * - the payer is credited the full amount even if not a participant
 * - a recorded settlement moves money: sender's net goes up,
 *   receiver's net goes down
 */
export function computeBalances(
  members: Member[],
  expenses: Expense[],
  settlements: Settlement[]
): Balance[] {
  const net = new Map<string, { paid: number; share: number }>();
  for (const m of members) net.set(m.user_id, { paid: 0, share: 0 });
  const touch = (id: string) => {
    if (!net.has(id)) net.set(id, { paid: 0, share: 0 });
    return net.get(id)!;
  };

  for (const e of expenses) {
    touch(e.paid_by).paid += e.amount_cents;
    const participants = e.participant_ids.length > 0 ? e.participant_ids : [e.paid_by];
    const base = Math.floor(e.amount_cents / participants.length);
    let remainder = e.amount_cents - base * participants.length;
    for (const p of participants) {
      // distribute leftover cents one-by-one so shares sum exactly
      touch(p).share += base + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder--;
    }
  }

  for (const s of settlements) {
    touch(s.from_user).paid += s.amount_cents;
    touch(s.to_user).share += s.amount_cents;
  }

  const nameOf = new Map(members.map((m) => [m.user_id, m.name]));
  return members.map((m) => {
    const n = net.get(m.user_id)!;
    return {
      userId: m.user_id,
      name: nameOf.get(m.user_id) ?? "Member",
      paidCents: n.paid,
      shareCents: n.share,
      netCents: n.paid - n.share,
    };
  });
}

/** Greedy plan: biggest debtor pays biggest creditor until everyone is square. */
export function computeTransfers(balances: Balance[]): Transfer[] {
  const debtors = balances
    .filter((b) => b.netCents < -1)
    .map((b) => ({ ...b, remaining: -b.netCents }))
    .sort((a, b) => b.remaining - a.remaining);
  const creditors = balances
    .filter((b) => b.netCents > 1)
    .map((b) => ({ ...b, remaining: b.netCents }))
    .sort((a, b) => b.remaining - a.remaining);

  const transfers: Transfer[] = [];
  let d = 0;
  let c = 0;
  while (d < debtors.length && c < creditors.length) {
    const pay = Math.min(debtors[d].remaining, creditors[c].remaining);
    transfers.push({
      fromId: debtors[d].userId,
      fromName: debtors[d].name,
      toId: creditors[c].userId,
      toName: creditors[c].name,
      amountCents: pay,
    });
    debtors[d].remaining -= pay;
    creditors[c].remaining -= pay;
    if (debtors[d].remaining <= 1) d++;
    if (creditors[c].remaining <= 1) c++;
  }
  return transfers;
}

export function formatKES(cents: number): string {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}
