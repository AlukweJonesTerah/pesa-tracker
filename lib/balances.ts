import type { Expense, Member } from "./db";

export type Balance = {
  userId: string;
  name: string;
  paidCents: number;
  shareCents: number;
  netCents: number; // positive = is owed money, negative = owes money
};

export type Settlement = {
  fromName: string;
  toName: string;
  amountCents: number;
};

/** Split every expense equally among all current members. */
export function computeBalances(members: Member[], expenses: Expense[]): Balance[] {
  const totalCents = expenses.reduce((sum, e) => sum + e.amount_cents, 0);
  const shareCents = members.length > 0 ? Math.round(totalCents / members.length) : 0;

  return members.map((m) => {
    const paidCents = expenses
      .filter((e) => e.paid_by === m.user_id)
      .reduce((sum, e) => sum + e.amount_cents, 0);
    return {
      userId: m.user_id,
      name: m.name,
      paidCents,
      shareCents,
      netCents: paidCents - shareCents,
    };
  });
}

/** Greedy settlement: biggest debtor pays biggest creditor until everyone is square. */
export function computeSettlements(balances: Balance[]): Settlement[] {
  const debtors = balances
    .filter((b) => b.netCents < -1)
    .map((b) => ({ ...b, remaining: -b.netCents }))
    .sort((a, b) => b.remaining - a.remaining);
  const creditors = balances
    .filter((b) => b.netCents > 1)
    .map((b) => ({ ...b, remaining: b.netCents }))
    .sort((a, b) => b.remaining - a.remaining);

  const settlements: Settlement[] = [];
  let d = 0;
  let c = 0;
  while (d < debtors.length && c < creditors.length) {
    const pay = Math.min(debtors[d].remaining, creditors[c].remaining);
    settlements.push({
      fromName: debtors[d].name,
      toName: creditors[c].name,
      amountCents: pay,
    });
    debtors[d].remaining -= pay;
    creditors[c].remaining -= pay;
    if (debtors[d].remaining <= 1) d++;
    if (creditors[c].remaining <= 1) c++;
  }
  return settlements;
}

export function formatKES(cents: number): string {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}
