export type BonusStatus = "active" | "released" | "cancelled";
export type Broker = {
  id: string;
  name: string;
  currency: "USD" | "EUR" | "HTG";
  initialBalance: number;
  ownDeposit?: number;
  bonusPercent?: number;
  turnoverRequired?: number;
  initialNetTurnover?: number;
  initialBonusProfit?: number;
  currentBalance?: number;
  baselineDate?: string; // Snapshot includes all activity through this date (end of day).
};
export type Entry = {
  id: string;
  brokerId: string;
  date: string;
  opening: number;
  closing: number;
  cashFlow: number;
  note: string;
  netTurnover?: number;
  bonusProfit?: number; // Broker-reported cumulative override; absent means automatic.
  estimatedBonusProfit?: number; // Derived display only; never persisted as an override.
  bonusStatus?: BonusStatus;
  reconciled?: boolean;
};
export type Goal = {
  id: string;
  brokerId: string;
  period: "weekly" | "monthly";
  start: string;
  end?: string;
  target: number;
};
export type Transaction = {
  id: string;
  brokerId: string;
  date: string;
  amount: number; // positive = deposit, negative = withdrawal
  note: string;
  bonusDeduction?: number;
  postBalance?: number;
  bonusStatus?: BonusStatus;
  afterClose?: boolean;
  order?: number;
};
export type State = {
  version: 1;
  brokers: Broker[];
  entries: Entry[];
  goals: Goal[];
  transactions: Transaction[];
};
export const emptyState: State = {
  version: 1,
  brokers: [],
  entries: [],
  goals: [],
  transactions: [],
};
function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function money(
  value: unknown,
  label: string,
  nonnegative = false,
): asserts value is number {
  check(
    typeof value === "number" &&
      Number.isFinite(value) &&
      Math.abs(value) <= 1e12 &&
      (!nonnegative || value >= 0),
    `${label} must be finite, within 1e12${nonnegative ? ", and nonnegative" : ""}.`,
  );
}
function identifier(value: unknown): asserts value is string {
  check(
    typeof value === "string" && value.trim().length > 0,
    "ID must be a nonempty string.",
  );
}
function validateBroker(broker: Broker) {
  identifier(broker.id);
  check(
    typeof broker.name === "string" &&
      broker.name.trim().length > 0 &&
      broker.name.trim().length <= 60,
    "Broker name must contain 1–60 characters.",
  );
  check(
    ["USD", "EUR", "HTG"].includes(broker.currency),
    "Unsupported currency.",
  );
  money(broker.initialBalance, "Initial balance", true);
  if (broker.baselineDate !== undefined) {
    isoDate(broker.baselineDate);
    check(
      broker.baselineDate <= localDate(),
      "Snapshot date cannot be in the future.",
    );
    check(
      broker.currentBalance !== undefined,
      "A snapshot date requires a current broker balance.",
    );
  }
  for (const key of [
    "ownDeposit",
    "bonusPercent",
    "turnoverRequired",
    "initialNetTurnover",
    "currentBalance",
  ] as const) {
    if (broker[key] !== undefined) money(broker[key], key, true);
  }
  if (broker.initialBonusProfit !== undefined)
    money(broker.initialBonusProfit, "Initial bonus profit");
  if ((broker.bonusPercent ?? 0) > 0) {
    check((broker.ownDeposit ?? 0) > 0, "A bonus requires your own deposit.");
    check(
      (broker.turnoverRequired ?? 0) > 0,
      "Enter the required turnover from your broker.",
    );
    money(
      broker.ownDeposit! * (1 + broker.bonusPercent! / 100),
      "Calculated initial balance",
      true,
    );
  }
}
export function saveBroker(
  state: State,
  broker: Broker,
  importing = false,
): State {
  validateBroker(broker);
  const previous = state.brokers.find((b) => b.id === broker.id);
  const unchangedLegacy =
    previous?.baselineDate === undefined &&
    previous?.currentBalance !== undefined &&
    previous.currentBalance === broker.currentBalance;
  if (!importing && broker.currentBalance !== undefined && !unchangedLegacy) {
    check(
      broker.baselineDate !== undefined,
      "Enter the end-of-day snapshot date for the current broker balance.",
    );
  }
  const next = {
    ...broker,
    name: broker.name.trim(),
    initialBalance:
      broker.ownDeposit === undefined
        ? broker.initialBalance
        : Math.round(
            broker.ownDeposit * (1 + (broker.bonusPercent ?? 0) / 100) * 100,
          ) / 100,
  };
  return {
    ...state,
    brokers: [...state.brokers.filter((b) => b.id !== broker.id), next],
  };
}

export function localDate(date = new Date()): string {
  return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function isoDate(value: unknown): asserts value is string {
  check(
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value),
    "Date must be YYYY-MM-DD.",
  );
  const date = new Date(`${value}T00:00:00.000Z`);
  check(
    Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value,
    "Date must be a real calendar date.",
  );
}
function validateEntry(entry: Entry) {
  identifier(entry.id);
  identifier(entry.brokerId);
  isoDate(entry.date);
  check(entry.date <= localDate(), "Entry date cannot be in the future.");
  money(entry.opening, "Opening balance", true);
  money(entry.closing, "Closing balance", true);
  money(entry.cashFlow, "Cash flow");
  if (entry.netTurnover !== undefined)
    money(entry.netTurnover, "Cumulative net turnover", true);
  if (entry.bonusProfit !== undefined)
    money(entry.bonusProfit, "Broker bonus profit");
  validateBonusStatus(entry.bonusStatus);
  check(
    entry.reconciled === undefined || typeof entry.reconciled === "boolean",
    "Invalid reconciliation flag.",
  );
  check(
    typeof entry.note === "string" && entry.note.length <= 500,
    "Note must be at most 500 characters.",
  );
}
export function saveEntry(
  state: State,
  entry: Entry,
  importing = false,
): State {
  validateEntry(entry);
  check(
    state.brokers.some((b) => b.id === entry.brokerId),
    "Broker does not exist.",
  );
  if (!importing)
    check(
      afterBaseline(
        state.brokers.find((b) => b.id === entry.brokerId)!,
        entry.date,
      ),
      "Entry date must be after the end-of-day snapshot date.",
    );
  check(
    !state.entries.some(
      (e) =>
        e.id !== entry.id &&
        e.brokerId === entry.brokerId &&
        e.date === entry.date,
    ),
    "An entry already exists for this broker and date.",
  );
  const stored = { ...entry };
  delete stored.estimatedBonusProfit;
  return {
    ...state,
    entries: [...state.entries.filter((e) => e.id !== entry.id), stored],
  };
}

function sameGoal(a: Goal, b: Goal) {
  return (
    a.brokerId === b.brokerId && a.period === b.period && a.start === b.start
  );
}
function goalEnd(goal: Goal): string {
  if (goal.end !== undefined) return goal.end;
  const date = new Date(`${goal.start}T00:00:00.000Z`);
  if (goal.period === "weekly") date.setUTCDate(date.getUTCDate() + 6);
  else date.setUTCMonth(date.getUTCMonth() + 1, 0);
  check(
    date.getUTCFullYear() <= 9999,
    "Goal end date exceeds year 9999; choose an explicit end date.",
  );
  return date.toISOString().slice(0, 10);
}
function validateGoal(goal: Goal) {
  identifier(goal.id);
  identifier(goal.brokerId);
  check(
    goal.period === "weekly" || goal.period === "monthly",
    "Goal period must be weekly or monthly.",
  );
  isoDate(goal.start);
  if (goal.end !== undefined) {
    isoDate(goal.end);
    check(goal.end >= goal.start, "End date must be on or after start date.");
  }
  goalEnd(goal);
  money(goal.target, "Goal target");
  check(goal.target > 0, "Goal target must be positive.");
}
export function saveGoal(state: State, goal: Goal): State {
  validateGoal(goal);
  check(
    state.brokers.some((b) => b.id === goal.brokerId),
    "Broker does not exist.",
  );
  return {
    ...state,
    goals: [
      ...state.goals.filter((g) => g.id !== goal.id && !sameGoal(g, goal)),
      { ...goal },
    ],
  };
}

export function deleteEntry(state: State, id: string): State {
  return { ...state, entries: state.entries.filter((e) => e.id !== id) };
}
export function deleteBroker(state: State, id: string): State {
  return {
    ...state,
    brokers: state.brokers.filter((b) => b.id !== id),
    entries: state.entries.filter((e) => e.brokerId !== id),
    goals: state.goals.filter((g) => g.brokerId !== id),
    transactions: state.transactions.filter((t) => t.brokerId !== id),
  };
}

export function goalProgress(
  goal: Goal,
  entries: Entry[],
): { earned: number; percent: number; end: string } {
  validateGoal(goal);
  const end = goalEnd(goal);
  const earned =
    Math.round(
      entries
        .filter(
          (e) =>
            e.brokerId === goal.brokerId &&
            e.date >= goal.start &&
            e.date <= end,
        )
        .reduce(
          (sum, e) => sum + performance(e.opening, e.closing, e.cashFlow).pnl,
          0,
        ) * 100,
    ) / 100;
  return { earned, percent: (earned / goal.target) * 100, end };
}

function validateTransaction(tx: Transaction) {
  if (tx.bonusDeduction !== undefined)
    money(tx.bonusDeduction, "Bonus deduction", true);
  if (tx.postBalance !== undefined)
    money(tx.postBalance, "Post-withdrawal balance", true);
  validateBonusStatus(tx.bonusStatus);
  check(
    tx.afterClose === undefined || typeof tx.afterClose === "boolean",
    "Invalid transaction timing.",
  );
  if (tx.order !== undefined) {
    money(tx.order, "Transaction order", true);
    check(Number.isInteger(tx.order), "Invalid transaction order.");
  }
  identifier(tx.id);
  identifier(tx.brokerId);
  isoDate(tx.date);
  check(tx.date <= localDate(), "Transaction date cannot be in the future.");
  money(tx.amount, "Transaction amount");
  check(tx.amount !== 0, "Transaction amount cannot be zero.");
  check(
    typeof tx.note === "string" && tx.note.length <= 500,
    "Note must be at most 500 characters.",
  );
}
export function saveTransaction(
  state: State,
  tx: Transaction,
  importing = false,
): State {
  validateTransaction(tx);
  if (!importing)
    check(
      !state.transactions.some(
        (t) =>
          t.id !== tx.id &&
          t.brokerId === tx.brokerId &&
          t.date === tx.date &&
          Boolean(t.afterClose) === Boolean(tx.afterClose) &&
          (t.order ?? 0) === (tx.order ?? 0),
      ),
      "Transaction order is already used for this broker, date and timing. Choose a unique chronological order.",
    );
  check(
    state.brokers.some((b) => b.id === tx.brokerId),
    "Broker does not exist.",
  );
  if (!importing)
    check(
      afterBaseline(
        state.brokers.find((b) => b.id === tx.brokerId)!,
        tx.date,
      ),
      "Transaction date must be after the end-of-day snapshot date.",
    );
  return {
    ...state,
    transactions: [
      ...state.transactions.filter((t) => t.id !== tx.id),
      { ...tx },
    ],
  };
}
export function deleteTransaction(state: State, id: string): State {
  return {
    ...state,
    transactions: state.transactions.filter((t) => t.id !== id),
  };
}

/**
 * Returns the effective current balance for a broker:
 * last recorded closing balance + any transactions logged after that entry.
 */
export function accountBalance(
  broker: Broker,
  entries: Entry[],
  transactions: Transaction[],
): number {
  const sorted = [...entries]
    .filter((e) => e.brokerId === broker.id && afterBaseline(broker, e.date))
    .sort((a, b) => a.date.localeCompare(b.date));
  const lastEntry = sorted.at(-1);
  const base =
    lastEntry?.closing ?? broker.currentBalance ?? broker.initialBalance;
  const lastDate = lastEntry?.date ?? "";
  const pending = transactions
    .filter(
      (t) =>
        t.brokerId === broker.id &&
        afterBaseline(broker, t.date) &&
        (t.date > lastDate || (t.date === lastDate && t.afterClose)),
    )
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        Number(a.afterClose ?? false) - Number(b.afterClose ?? false) ||
        (a.order ?? 0) - (b.order ?? 0) ||
        a.id.localeCompare(b.id),
    );
  return pending.reduce(
    (balance, t) =>
      t.postBalance ?? balance + t.amount - (t.bonusDeduction ?? 0),
    base,
  );
}

function record(value: unknown): asserts value is Record<string, unknown> {
  check(
    typeof value === "object" && value !== null && !Array.isArray(value),
    "Invalid state: expected an object.",
  );
}
export function parseState(input: unknown): State {
  record(input);
  check(input.version === 1, "Unsupported state version; expected version 1.");
  check(
    Array.isArray(input.brokers) &&
      Array.isArray(input.entries) &&
      Array.isArray(input.goals),
    "Invalid state: brokers, entries and goals must be arrays.",
  );
  let state: State = {
    version: 1,
    brokers: [],
    entries: [],
    goals: [],
    transactions: [],
  };
  for (const value of input.brokers) {
    record(value);
    const broker = value as unknown as Broker;
    check(
      !state.brokers.some((b) => b.id === broker.id),
      "Duplicate broker ID.",
    );
    state = saveBroker(state, broker, true);
  }
  for (const value of input.entries) {
    record(value);
    const entry = value as unknown as Entry;
    check(!state.entries.some((e) => e.id === entry.id), "Duplicate entry ID.");
    state = saveEntry(state, entry, true);
  }
  for (const value of input.goals) {
    record(value);
    const goal = value as unknown as Goal;
    check(
      !state.goals.some((g) => g.id === goal.id || sameGoal(g, goal)),
      "Duplicate goal ID or period.",
    );
    state = saveGoal(state, goal);
  }
  // Backward-compatible: old backups have no transactions field
  check(
    input.transactions === undefined || Array.isArray(input.transactions),
    "Invalid state: transactions must be an array.",
  );
  const rawTxs = Array.isArray((input as Record<string, unknown>).transactions)
    ? ((input as Record<string, unknown>).transactions as unknown[])
    : [];
  for (const value of rawTxs) {
    record(value);
    const tx = value as unknown as Transaction;
    check(
      !state.transactions.some((t) => t.id === tx.id),
      "Duplicate transaction ID.",
    );
    state = saveTransaction(state, tx, true);
  }
  return state;
}

export function performance(opening: number, closing: number, cashFlow = 0) {
  const pnl = Math.round((closing - opening - cashFlow) * 100) / 100;
  return { pnl, percent: opening === 0 ? null : (pnl / opening) * 100 };
}

export function bonusSummary(
  broker: Broker,
  entries: Entry[],
  transactions: Transaction[],
) {
  const sorted = entries
    .filter((e) => e.brokerId === broker.id && afterBaseline(broker, e.date))
    .sort((a, b) => a.date.localeCompare(b.date));
  const principal =
    Math.round((broker.ownDeposit ?? 0) * (broker.bonusPercent ?? 0)) / 100;
  const history = bonusProfitHistory(broker, entries, transactions);
  const profit = history.profit;
  const profitSource = history.source;
  const netTurnover =
    sorted.filter((e) => e.netTurnover !== undefined).at(-1)?.netTurnover ??
    broker.initialNetTurnover ??
    0;
  const events = [
    ...sorted.map((e) => ({
      id: e.id,
      date: e.date,
      phase: 1,
      order: 0,
      status: e.bonusStatus,
    })),
    ...transactions
      .filter((t) => t.brokerId === broker.id && afterBaseline(broker, t.date))
      .map((t) => ({
        id: t.id,
        date: t.date,
        phase: t.afterClose ? 2 : 0,
        order: t.order ?? 0,
        status: t.bonusStatus,
      })),
  ]
    .filter((e) => e.status)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.phase - b.phase ||
        a.order - b.order ||
        a.id.localeCompare(b.id),
    );
  const status = events.at(-1)?.status ?? "active";
  const total = accountBalance(broker, entries, transactions);
  const required = broker.turnoverRequired ?? 0;
  return {
    total,
    free: Math.max(
      0,
      total - (status === "active" ? Math.max(0, principal + profit) : 0),
    ),
    principal,
    profit,
    profitSource,
    netTurnover,
    required,
    percent: required > 0 ? Math.min(100, (netTurnover / required) * 100) : 0,
    status,
  };
}

function validateBonusStatus(status: unknown) {
  check(
    status === undefined ||
      ["active", "released", "cancelled"].includes(status as string),
    "Invalid bonus status.",
  );
}

/** Undated legacy snapshots retain their original all-history semantics. */
export function afterBaseline(broker: Broker, date: string): boolean {
  return broker.baselineDate === undefined || date > broker.baselineDate;
}

/** Derived history excludes snapshot-covered activity; raw backups retain it. */
export function reconciledEntries(state: State): Entry[] {
  const accounting = accountingEntries(state);
  const estimates = new Map<string, number>();
  for (const broker of state.brokers) {
    for (const [id, value] of bonusProfitHistory(
      broker,
      accounting,
      state.transactions,
    ).estimates)
      estimates.set(id, value);
  }
  return accounting.map((entry) => ({
    ...entry,
    estimatedBonusProfit: estimates.get(entry.id),
  }));
}

/** Recompute from raw P&L, never from a previously derived estimate. */
function bonusProfitHistory(
  broker: Broker,
  entries: Entry[],
  transactions: Transaction[],
) {
  const accounting = accountingEntries({
    ...emptyState,
    brokers: [broker],
    entries: entries.filter((e) => e.brokerId === broker.id),
    transactions,
  });
  const principal =
    Math.round((broker.ownDeposit ?? 0) * (broker.bonusPercent ?? 0)) / 100;
  const capital = (broker.ownDeposit ?? 0) + principal;
  const ratio = capital > 0 ? principal / capital : 0;
  let profit = broker.initialBonusProfit ?? 0;
  let source: "estimated" | "broker-reported" =
    broker.initialBonusProfit === undefined ? "estimated" : "broker-reported";
  const estimates = new Map<string, number>();
  let status: BonusStatus = "active";
  const events = [
    ...accounting.map((entry) => ({
      date: entry.date,
      phase: 1,
      order: 0,
      id: entry.id,
      status: entry.bonusStatus,
      entry,
    })),
    ...transactions
      .filter((t) => t.brokerId === broker.id && afterBaseline(broker, t.date))
      .map((t) => ({
        date: t.date,
        phase: t.afterClose ? 2 : 0,
        order: t.order ?? 0,
        id: t.id,
        status: t.bonusStatus,
        entry: undefined,
      })),
  ].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.phase - b.phase ||
      a.order - b.order ||
      a.id.localeCompare(b.id),
  );
  for (const event of events) {
    if (event.status) status = event.status;
    const entry = event.entry;
    if (!entry) continue;
    if (entry.bonusProfit !== undefined) {
      profit = entry.bonusProfit;
      source = "broker-reported";
    } else if (principal > 0 && status === "active") {
      profit +=
        performance(entry.opening, entry.closing, entry.cashFlow).pnl * ratio;
      source = "estimated";
      estimates.set(
        entry.id,
        Math.max(-principal, Math.round(profit * 100) / 100),
      );
    }
  }
  // An estimate cannot consume more than the initial bonus principal. Keep
  // the unbounded running value internally so recovery does not invent gains.
  // Broker overrides, including negative readings, remain exactly as entered.
  return {
    profit:
      source === "estimated"
        ? Math.max(-principal, Math.round(profit * 100) / 100)
        : profit,
    source,
    estimates,
  };
}

function accountingEntries(state: State): Entry[] {
  const entries = state.entries.filter((entry) =>
    afterBaseline(
      state.brokers.find((b) => b.id === entry.brokerId)!,
      entry.date,
    ),
  );
  return entries.map((entry) => {
    if (!entry.reconciled) return entry;
    const broker = state.brokers.find((b) => b.id === entry.brokerId)!;
    const previous = entries
      .filter((e) => e.brokerId === entry.brokerId && e.date < entry.date)
      .sort((a, b) => a.date.localeCompare(b.date))
      .at(-1);
    const cashFlow = state.transactions
      .filter(
        (t) =>
          t.brokerId === entry.brokerId &&
          afterBaseline(broker, t.date) &&
          (!previous ||
            t.date > previous.date ||
            (t.date === previous.date && t.afterClose)) &&
          (t.date < entry.date || (t.date === entry.date && !t.afterClose)),
      )
      .reduce((sum, t) => sum + t.amount - (t.bonusDeduction ?? 0), 0);
    return {
      ...entry,
      opening:
        previous?.closing ?? broker.currentBalance ?? broker.initialBalance,
      cashFlow,
    };
  });
}
