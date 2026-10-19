import { describe, expect, it } from "vitest";
import * as domain from "./domain";
import { performance } from "./domain";

const broker = {
  id: "b",
  name: " Broker ",
  currency: "USD" as const,
  initialBalance: 1000,
};
it("saves and updates a broker immutably with a trimmed name", () => {
  const state = domain.saveBroker(domain.emptyState, broker);
  expect(state.brokers).toEqual([{ ...broker, name: "Broker" }]);
  expect(domain.emptyState.brokers).toEqual([]);
  expect(
    domain.saveBroker(state, { ...broker, name: "New" }).brokers,
  ).toHaveLength(1);
});
it.each([
  { name: "" },
  { name: " ".repeat(5) },
  { name: "x".repeat(61) },
  { initialBalance: -1 },
  { initialBalance: Infinity },
  { initialBalance: NaN },
  { initialBalance: 1e12 + 1 },
  { currency: "GBP" },
  { id: "" },
])("rejects invalid broker %j", (change) => {
  expect(() =>
    domain.saveBroker(domain.emptyState, {
      ...broker,
      ...change,
    } as domain.Broker),
  ).toThrow();
});
const entry = {
  id: "e",
  brokerId: "b",
  date: "2024-02-29",
  opening: 1000,
  closing: 950,
  cashFlow: -100,
  note: "",
};
it("records a dated entry, updates its ID, and prevents duplicate broker days", () => {
  const state = domain.saveBroker(domain.emptyState, broker);
  const saved = domain.saveEntry(state, entry);
  expect(saved.entries).toEqual([entry]);
  expect(state.entries).toEqual([]);
  expect(domain.saveEntry(saved, { ...entry, closing: 900 }).entries).toEqual([
    { ...entry, closing: 900 },
  ]);
  expect(() => domain.saveEntry(saved, { ...entry, id: "other" })).toThrow(
    /date|day/i,
  );
});
it.each([
  { date: "2023-02-29" },
  { date: "2024-04-31" },
  { date: "9999-01-01" },
  { date: "2024-2-01" },
  { opening: -1 },
  { closing: Infinity },
  { cashFlow: -1e13 },
  { note: "x".repeat(501) },
  { brokerId: "missing" },
  { id: "" },
])("rejects invalid entry %j", (change) => {
  expect(() =>
    domain.saveEntry(domain.saveBroker(domain.emptyState, broker), {
      ...entry,
      ...change,
    }),
  ).toThrow();
});
it("uses local calendar dates", () => {
  expect(domain.localDate(new Date(2024, 0, 2, 23, 59))).toBe("2024-01-02");
  expect(domain.localDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});
const goal: domain.Goal = {
  id: "g",
  brokerId: "b",
  period: "weekly",
  start: "2024-02-29",
  target: 100,
};
it("upserts a goal by its broker, period and start", () => {
  const state = domain.saveGoal(
    domain.saveBroker(domain.emptyState, broker),
    goal,
  );
  expect(state.goals).toEqual([goal]);
  const updated = domain.saveGoal(state, { ...goal, id: "new", target: 200 });
  expect(updated.goals).toEqual([{ ...goal, id: "new", target: 200 }]);
});
it.each([
  { target: 0 },
  { target: -1 },
  { target: Infinity },
  { target: 1e13 },
  { period: "daily" },
  { start: "2024-02-30" },
  { period: "monthly", start: "2024-02-02" },
  { brokerId: "missing" },
  { id: "" },
])("rejects invalid goal %j", (change) => {
  expect(() =>
    domain.saveGoal(domain.saveBroker(domain.emptyState, broker), {
      ...goal,
      ...change,
    } as domain.Goal),
  ).toThrow();
});
it("deletes entries immutably and cascades broker removal without affecting other brokers", () => {
  let state = domain.saveGoal(
    domain.saveEntry(domain.saveBroker(domain.emptyState, broker), entry),
    goal,
  );
  state = domain.saveBroker(state, { ...broker, id: "other" });
  expect(domain.deleteEntry(state, "e").entries).toEqual([]);
  expect(state.entries).toHaveLength(1);
  expect(domain.deleteBroker(state, "b")).toEqual({
    version: 1,
    brokers: [{ ...broker, id: "other", name: "Broker" }],
    entries: [],
    goals: [],
  });
});
it("measures seven inclusive goal days across a month boundary excluding other brokers", () => {
  const entries = ["2024-02-28", "2024-02-29", "2024-03-06", "2024-03-07"].map(
    (date, i) => ({ ...entry, date, id: String(i) }),
  );
  expect(
    domain.goalProgress(goal, [...entries, { ...entry, brokerId: "other" }]),
  ).toEqual({ earned: 100, percent: 100, end: "2024-03-06" });
});
it.each([
  ["2024-02-01", "2024-02-29"],
  ["2023-02-01", "2023-02-28"],
  ["2024-12-01", "2024-12-31"],
])("uses the entire calendar month %s", (start, end) => {
  expect(
    domain.goalProgress({ ...goal, period: "monthly", start }, [
      { ...entry, date: end },
    ]),
  ).toEqual({ earned: 50, percent: 50, end });
});
it("forecasts a geometric daily return from the latest closing regardless of input order", () => {
  const entries = [
    { ...entry, date: "2024-03-01", opening: 100, closing: 80, cashFlow: 0 },
    { ...entry, date: "2024-02-29", opening: 100, closing: 125, cashFlow: 0 },
  ];
  expect(domain.forecast(entries, 1000, 10).rate).toBeCloseTo(0);
  expect(domain.forecast(entries, 1000, 10).balance).toBeCloseTo(80);
  expect(entries[0].date).toBe("2024-03-01");
});
it("leaves balance unchanged until two usable returns exist", () => {
  expect(domain.forecast([], 1000, 10)).toEqual({ balance: 1000, rate: null });
  expect(domain.forecast([entry], 1000, 10)).toEqual({
    balance: 950,
    rate: null,
  });
  expect(
    domain.forecast(
      [entry, { ...entry, opening: 0 }, { ...entry, cashFlow: 2000 }],
      1000,
      10,
    ),
  ).toEqual({ balance: 950, rate: null });
});
it("compounds losses and handles complete loss without NaN", () => {
  const loss = { ...entry, opening: 100, closing: 90, cashFlow: 0 };
  expect(domain.forecast([loss, loss], 1000, 2).balance).toBeCloseTo(72.9);
  expect(domain.forecast([loss, { ...loss, closing: 0 }], 1000, 2)).toEqual({
    balance: 0,
    rate: -1,
  });
});
it.each([0, -1, 1.5, 366, Infinity, NaN])(
  "rejects invalid session count %s",
  (sessions) => {
    expect(() => domain.forecast([entry, entry], 1000, sessions)).toThrow(
      /sessions/i,
    );
  },
);
it("rejects forecast overflow clearly", () => {
  const huge = { ...entry, opening: 0.01, closing: 1e12, cashFlow: 0 };
  expect(() => domain.forecast([huge, huge], 1000, 365)).toThrow(/overflow/i);
});
it("parses a complete backup into an independent validated state", () => {
  const input = {
    version: 1,
    brokers: [{ ...broker, name: "Broker" }],
    entries: [entry],
    goals: [goal],
  };
  const parsed = domain.parseState(input);
  expect(parsed).toEqual(input);
  expect(parsed).not.toBe(input);
  expect(parsed.entries[0]).not.toBe(entry);
});
const backup = {
  version: 1,
  brokers: [broker],
  entries: [entry],
  goals: [goal],
};
it.each([
  null,
  [],
  {},
  { ...backup, version: 2 },
  { ...backup, brokers: null },
  { ...backup, entries: {} },
  { ...backup, goals: null },
  { ...backup, brokers: [null] },
  { ...backup, brokers: [{ ...broker, currency: "GBP" }] },
  { ...backup, brokers: [broker, broker] },
  { ...backup, entries: [entry, entry] },
  { ...backup, entries: [entry, { ...entry, id: "e2" }] },
  { ...backup, entries: [{ ...entry, brokerId: "missing" }] },
  { ...backup, entries: [{ ...entry, opening: "100" }] },
  { ...backup, entries: [{ ...entry, note: null }] },
  { ...backup, entries: [{ ...entry, date: "2024-02-30" }] },
  { ...backup, goals: [goal, goal] },
  { ...backup, goals: [goal, { ...goal, id: "g2" }] },
  { ...backup, goals: [{ ...goal, period: "monthly" }] },
  { ...backup, goals: [{ ...goal, target: NaN }] },
  { ...backup, goals: [{ ...goal, brokerId: "missing" }] },
])("rejects malformed backup %#", (input) => {
  expect(() => domain.parseState(input)).toThrow();
});
it.each([NaN, Infinity, -1, 1e12 + 1])(
  "rejects invalid forecast initial balance %s",
  (initial) => {
    expect(() => domain.forecast([], initial, 1)).toThrow(/balance/i);
  },
);
it("rejects invalid forecast entry money", () => {
  expect(() => domain.forecast([{ ...entry, closing: NaN }], 1000, 1)).toThrow(
    /balance/i,
  );
});
it("handles zero denominators and excludes withdrawals from profit", () => {
  expect(performance(0, 100, 100)).toEqual({ pnl: 0, percent: null });
  expect(performance(1000, 950, -100)).toEqual({ pnl: 50, percent: 5 });
});
it("accepts money and text at their validation boundaries", () => {
  const state = domain.saveBroker(domain.emptyState, {
    ...broker,
    initialBalance: 1e12,
    name: "x".repeat(60),
  });
  expect(
    domain.saveEntry(state, {
      ...entry,
      opening: 0,
      closing: 1e12,
      cashFlow: -1e12,
      note: "x".repeat(500),
      date: domain.localDate(),
    }).entries,
  ).toHaveLength(1);
});
describe("daily performance", () => {
  it("calculates net profit and return without treating deposits as profit", () => {
    expect(performance(1000, 1250, 200)).toEqual({ pnl: 50, percent: 5 });
  });
});
