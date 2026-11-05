import { expect, it } from "vitest";
import {
  emptyState,
  saveBroker,
  accountBalance,
  bonusSummary,
  reconciledEntries,
  saveEntry,
  saveTransaction,
  deleteEntry,
  deleteTransaction,
  parseState,
  performance,
  type Broker,
  type Entry,
  type Transaction,
} from "./domain";
it("calculates starting total from own deposit and optional bonus without inventing profit", () => {
  const b = {
    id: "b",
    name: "Broker",
    currency: "USD" as const,
    initialBalance: 0,
    ownDeposit: 100,
    bonusPercent: 50,
    turnoverRequired: 2000,
    initialNetTurnover: 400,
    initialBonusProfit: 12,
  };
  expect(saveBroker(emptyState, b).brokers[0].initialBalance).toBe(150);
});
it("starts an existing account from the reported current balance, not historical deposit", () => {
  const b = {
    id: "b",
    name: "Broker",
    currency: "USD" as const,
    initialBalance: 150,
    currentBalance: 182,
  };
  expect(accountBalance(b, [], [])).toBe(182);
});
const broker: Broker = {
  id: "b",
  name: "Broker",
  currency: "USD",
  initialBalance: 150,
  ownDeposit: 100,
  bonusPercent: 50,
  turnoverRequired: 2000,
  initialNetTurnover: 400,
  initialBonusProfit: 12,
  currentBalance: 182,
  baselineDate: "2024-01-01",
};
const entry: Entry = {
  id: "e",
  brokerId: "b",
  date: "2024-01-02",
  opening: 182,
  closing: 200,
  cashFlow: 0,
  note: "",
  netTurnover: 2200,
  bonusProfit: 19,
  reconciled: true,
};
it("estimates gain from the existing-account snapshot without changing raw records", () => {
  const automatic = { ...entry, bonusProfit: undefined };
  const state = { ...emptyState, brokers: [broker], entries: [automatic] };
  expect(bonusSummary(broker, state.entries, []).profit).toBe(18);
  expect(bonusSummary(broker, state.entries, [])).toMatchObject({
    profitSource: "estimated",
    free: 132,
  });
  expect(reconciledEntries(state)[0]).toMatchObject({
    estimatedBonusProfit: 18,
  });
  expect(state.entries[0].bonusProfit).toBeUndefined();
});
it.each(["released", "cancelled"] as const)(
  "stops estimates at %s, retaining earlier estimates and exact deductions",
  (status) => {
    const first = { ...entry, bonusProfit: undefined };
    const later = { ...first, id: "later", date: "2024-01-03", closing: 140 };
    const decision = { ...tx, bonusStatus: status };
    expect(bonusSummary(broker, [later, first], [decision])).toMatchObject({
      profit: 18,
      status,
      free: 140,
    });
    expect(
      reconciledEntries({
        ...emptyState,
        brokers: [broker],
        entries: [first, later],
        transactions: [decision],
      })[1].estimatedBonusProfit,
    ).toBeUndefined();
    expect(
      bonusSummary(broker, [{ ...first, bonusStatus: status }], []).profit,
    ).toBe(12);
    expect(
      bonusSummary(broker, [first], [{ ...decision, afterClose: false }])
        .profit,
    ).toBe(12);
  },
);
it("never stores derived estimates in records or restored backups", () => {
  const state = {
    ...emptyState,
    brokers: [broker],
    entries: [{ ...entry, bonusProfit: undefined }],
  };
  const derived = reconciledEntries(state)[0];
  expect(saveEntry(state, derived).entries[0]).not.toHaveProperty(
    "estimatedBonusProfit",
  );
  expect(
    parseState({ ...state, entries: [derived] }).entries[0],
  ).not.toHaveProperty("estimatedBonusProfit");
});
it("recomputes losses, cash flows and backdated changes without cumulative double counting", () => {
  const first = { ...entry, bonusProfit: undefined };
  const later = { ...first, id: "later", date: "2024-01-03", closing: 170 };
  let state = {
    ...emptyState,
    brokers: [broker],
    entries: [later, first],
    transactions: [
      {
        ...tx,
        amount: 30,
        bonusDeduction: 0,
        bonusStatus: undefined,
        postBalance: undefined,
      },
    ],
  };
  expect(bonusSummary(broker, state.entries, state.transactions).profit).toBe(
    -2,
  );
  expect(
    bonusSummary(broker, reconciledEntries(state), state.transactions).profit,
  ).toBe(-2);
  expect(
    reconciledEntries(state).find((e) => e.id === "later")
      ?.estimatedBonusProfit,
  ).toBe(-2);
  state = { ...state, entries: [later, { ...first, closing: 194 }] };
  expect(bonusSummary(broker, state.entries, state.transactions).profit).toBe(
    -2,
  );
  expect(bonusSummary(broker, state.entries, []).profit).toBe(8);
  expect(
    bonusSummary(broker, [{ ...first, bonusProfit: 0 }, later], []).profit,
  ).toBe(-10);
  expect(
    bonusSummary(broker, [{ ...first, bonusProfit: 19 }, later], []).profit,
  ).toBe(9);
  expect(bonusSummary({ ...broker, bonusPercent: 0 }, [first], []).profit).toBe(
    12,
  );
});
it.each([false, true])(
  "excludes active withdrawals and deductions with afterClose=%s",
  (afterClose) => {
    const first = { ...entry, bonusProfit: undefined };
    const movement = {
      ...tx,
      amount: -20,
      bonusDeduction: 9,
      postBalance: undefined,
      bonusStatus: undefined,
      afterClose,
    };
    const second = { ...first, id: "second", date: "2024-01-03", closing: 183 };
    const adjustedFirst = { ...first, closing: afterClose ? 200 : 171 };
    expect(
      bonusSummary(broker, [adjustedFirst, second], [movement]).profit,
    ).toBe(22);
    expect(bonusSummary(broker, [adjustedFirst], [movement]).profit).toBe(18);
  },
);
it("ignores covered snapshots and other accounts in automatic allocation", () => {
  const auto = { ...entry, bonusProfit: undefined };
  const covered = {
    ...entry,
    id: "covered",
    date: broker.baselineDate!,
    bonusProfit: 900,
    bonusStatus: "cancelled" as const,
  };
  const other = { ...auto, id: "other", brokerId: "other", closing: 9000 };
  expect(
    bonusSummary(
      broker,
      [covered, other, auto],
      [{ ...tx, date: broker.baselineDate! }],
    ),
  ).toMatchObject({ profit: 18, free: 132, status: "active" });
});
it("rounds cumulative estimates only for display, not after each daily allocation", () => {
  const b = { ...broker, initialBonusProfit: 0, currentBalance: 150 };
  const entries = [1, 2, 3].map((n) => ({
    ...entry,
    id: `fraction-${n}`,
    date: `2024-01-0${n + 1}`,
    closing: 150 + n / 100,
    bonusProfit: undefined,
  }));
  expect(bonusSummary(b, entries, []).profit).toBe(0.01);
  expect(
    reconciledEntries({ ...emptyState, brokers: [b], entries }).at(-1)
      ?.estimatedBonusProfit,
  ).toBe(0.01);
});
it("bounds estimated losses at the initial principal without discarding the recovery deficit", () => {
  const manual = { ...entry, bonusProfit: 0 };
  const loss = {
    ...entry,
    id: "loss",
    date: "2024-01-03",
    closing: 20,
    bonusProfit: undefined,
  };
  const recovery = { ...loss, id: "recovery", date: "2024-01-04", closing: 80 };
  expect(bonusSummary(broker, [manual, loss], [])).toMatchObject({
    profit: -50,
    free: 20,
    profitSource: "estimated",
  });
  expect(bonusSummary(broker, [manual, loss, recovery], []).profit).toBe(-40);
  // Manual broker readings are never clamped or silently rewritten.
  expect(bonusSummary(broker, [{ ...loss, bonusProfit: -60 }], []).profit).toBe(
    -60,
  );
});
it("uses latest cumulative broker turnover and profit, without releasing at the goal", () => {
  expect(bonusSummary(broker, [entry], [])).toMatchObject({
    total: 200,
    free: 131,
    principal: 50,
    profit: 19,
    netTurnover: 2200,
    required: 2000,
    percent: 100,
    status: "active",
  });
  expect(
    bonusSummary(
      broker,
      [{ ...entry, id: "later", date: "2024-01-03", netTurnover: 2100 }, entry],
      [],
    ).netTurnover,
  ).toBe(2100);
  expect(
    bonusSummary(broker, [{ ...entry, bonusStatus: "released" }], []).free,
  ).toBe(200);
  expect(bonusSummary(broker, [], []).free).toBe(120);
});
it.each([
  { ownDeposit: -1 },
  { bonusPercent: Infinity },
  { turnoverRequired: -1 },
  { initialNetTurnover: NaN },
  { initialBonusProfit: Infinity },
  { currentBalance: -1 },
  { bonusPercent: 50, turnoverRequired: 0 },
])("rejects invalid bonus setup %j", (change) => {
  expect(() => saveBroker(emptyState, { ...broker, ...change })).toThrow();
});
it.each([
  { netTurnover: -1 },
  { bonusProfit: NaN },
  { bonusStatus: "invented" },
  { reconciled: "yes" },
])("rejects invalid snapshot %j", (change) => {
  expect(() =>
    saveEntry(saveBroker(emptyState, broker), { ...entry, ...change } as Entry),
  ).toThrow();
});
it.each([
  { bonusDeduction: -1 },
  { postBalance: -1 },
  { bonusStatus: "invented" },
  { afterClose: "yes" },
  { order: NaN },
])("rejects invalid withdrawal %j", (change) => {
  expect(() =>
    saveTransaction(saveBroker(emptyState, broker), {
      ...tx,
      ...change,
    } as Transaction),
  ).toThrow();
});
const tx: Transaction = {
  id: "t",
  brokerId: "b",
  date: "2024-01-02",
  amount: -20,
  bonusDeduction: 69,
  postBalance: 111,
  bonusStatus: "cancelled",
  afterClose: true,
  order: 1,
  note: "Broker cancelled bonus",
};
it("records exact withdrawal and deduction after same-day close, without trading loss", () => {
  let s = saveTransaction(saveEntry(saveBroker(emptyState, broker), entry), tx);
  expect(accountBalance(broker, s.entries, s.transactions)).toBe(111);
  expect(bonusSummary(broker, s.entries, s.transactions).free).toBe(111);
  s = saveEntry(s, { ...entry, id: "e2", date: "2024-01-03", closing: 121 });
  let e = reconciledEntries(s).find((e) => e.id === "e2")!;
  expect(performance(e.opening, e.closing, e.cashFlow).pnl).toBe(10);
  expect(
    accountBalance(broker, deleteEntry(s, "e2").entries, s.transactions),
  ).toBe(111);
  const noTx = deleteTransaction(s, "t");
  e = reconciledEntries(noTx).find((e) => e.id === "e2")!;
  expect(performance(e.opening, e.closing, e.cashFlow).pnl).toBe(-79);
  expect(bonusSummary(broker, noTx.entries, noTx.transactions).status).toBe(
    "active",
  );
  const before = { ...tx, afterClose: false, postBalance: 93 };
  s = saveTransaction(
    saveEntry(saveBroker(emptyState, broker), { ...entry, closing: 103 }),
    before,
  );
  e = reconciledEntries(s)[0];
  expect(accountBalance(broker, s.entries, s.transactions)).toBe(103);
  expect(performance(e.opening, e.closing, e.cashFlow).pnl).toBe(10);
  expect(parseState(JSON.parse(JSON.stringify(s)))).toEqual(s);
});
