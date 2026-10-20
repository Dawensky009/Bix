export type Broker = {
  id: string;
  name: string;
  currency: "USD" | "EUR" | "HTG";
  initialBalance: number;
};
export type Entry = {
  id: string;
  brokerId: string;
  date: string;
  opening: number;
  closing: number;
  cashFlow: number;
  note: string;
};
export type Goal = {
  id: string;
  brokerId: string;
  period: "weekly" | "monthly";
  start: string;
  end?: string;
  target: number;
};
export type State = {
  version: 1;
  brokers: Broker[];
  entries: Entry[];
  goals: Goal[];
};
export const emptyState: State = {
  version: 1,
  brokers: [],
  entries: [],
  goals: [],
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
}
export function saveBroker(state: State, broker: Broker): State {
  validateBroker(broker);
  const next = { ...broker, name: broker.name.trim() };
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
  check(
    typeof entry.note === "string" && entry.note.length <= 500,
    "Note must be at most 500 characters.",
  );
}
export function saveEntry(state: State, entry: Entry): State {
  validateEntry(entry);
  check(
    state.brokers.some((b) => b.id === entry.brokerId),
    "Broker does not exist.",
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
  return {
    ...state,
    entries: [...state.entries.filter((e) => e.id !== entry.id), { ...entry }],
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

export function forecast(
  entries: Entry[],
  initialBalance: number,
  sessions: number,
): { balance: number; rate: number | null } {
  money(initialBalance, "Initial balance", true);
  entries.forEach(validateEntry);
  check(
    Number.isInteger(sessions) && sessions >= 1 && sessions <= 365,
    "Sessions must be an integer from 1 to 365.",
  );
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const balance = sorted.length
    ? sorted[sorted.length - 1].closing
    : initialBalance;
  const factors = entries
    .filter((e) => e.opening > 0)
    .map((e) => (e.closing - e.cashFlow) / e.opening)
    .filter((f) => Number.isFinite(f) && f >= 0);
  if (factors.length < 2) return { balance, rate: null };
  const rate =
    Math.exp(
      factors.reduce((sum, factor) => sum + Math.log(factor), 0) /
        factors.length,
    ) - 1;
  const projected = balance * (1 + rate) ** sessions;
  check(
    Number.isFinite(projected) && Number.isFinite(rate),
    "Forecast overflow: use fewer sessions or less extreme returns.",
  );
  return { balance: projected, rate };
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
  let state: State = { version: 1, brokers: [], entries: [], goals: [] };
  for (const value of input.brokers) {
    record(value);
    const broker = value as unknown as Broker;
    check(
      !state.brokers.some((b) => b.id === broker.id),
      "Duplicate broker ID.",
    );
    state = saveBroker(state, broker);
  }
  for (const value of input.entries) {
    record(value);
    const entry = value as unknown as Entry;
    check(!state.entries.some((e) => e.id === entry.id), "Duplicate entry ID.");
    state = saveEntry(state, entry);
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
  return state;
}

export function performance(opening: number, closing: number, cashFlow = 0) {
  const pnl = Math.round((closing - opening - cashFlow) * 100) / 100;
  return { pnl, percent: opening === 0 ? null : (pnl / opening) * 100 };
}
