import { expect, it } from "vitest";
import {
  accountBalance,
  bonusSummary,
  emptyState,
  parseState,
  performance,
  reconciledEntries,
  saveBroker,
  saveEntry,
  saveTransaction,
  type Broker,
  type Entry,
  type Transaction,
} from "./domain";
const broker = {
  id: "b",
  name: "Snapshot",
  currency: "USD",
  initialBalance: 100,
  currentBalance: 150,
  baselineDate: "2024-01-02",
  initialNetTurnover: 400,
  initialBonusProfit: 12,
} as Broker;
const oldTx: Transaction = {
  id: "old",
  brokerId: "b",
  date: "2024-01-02",
  amount: 50,
  postBalance: 999,
  afterClose: true,
  bonusStatus: "cancelled",
  note: "",
};
const oldEntry: Entry = {
  id: "old-e",
  brokerId: "b",
  date: "2024-01-02",
  opening: 100,
  closing: 999,
  cashFlow: 0,
  netTurnover: 999,
  bonusProfit: 999,
  bonusStatus: "released",
  note: "",
};
const entry: Entry = {
  id: "e",
  brokerId: "b",
  date: "2024-01-03",
  opening: 0,
  closing: 150,
  cashFlow: 0,
  reconciled: true,
  note: "",
};
it("requires valid dated new snapshots, preserves legacy imports, and rejects baseline-day or earlier saves", () => {
  const legacy = { ...broker, baselineDate: undefined };
  expect(() => saveBroker(emptyState, legacy)).toThrow(/snapshot date/i);
  expect(parseState({ ...emptyState, brokers: [legacy] }).brokers[0]).toEqual(
    legacy,
  );
  for (const baselineDate of ["2024-02-30", "9999-01-01"]) {
    expect(() => saveBroker(emptyState, { ...broker, baselineDate })).toThrow();
  }
  expect(() =>
    saveBroker(emptyState, { ...broker, currentBalance: undefined }),
  ).toThrow(/balance/i);
  const state = saveBroker(emptyState, broker);
  for (const date of ["2024-01-01", "2024-01-02"]) {
    expect(() => saveEntry(state, { ...entry, date })).toThrow(
      /after.*snapshot/i,
    );
    expect(() => saveTransaction(state, { ...oldTx, date })).toThrow(
      /after.*snapshot/i,
    );
  }
  expect(saveEntry(state, entry).entries).toHaveLength(1);
  expect(
    saveTransaction(state, { ...oldTx, date: "2024-01-03" }).transactions,
  ).toHaveLength(1);
  expect(() => saveBroker(state, legacy)).toThrow(/snapshot date/i);
});
it("end-of-day snapshot excludes older cashflows, closings, statuses and readings from balances and first P&L", () => {
  const state = {
    ...emptyState,
    brokers: [broker],
    entries: [oldEntry, entry],
    transactions: [oldTx],
  };
  expect(
    accountBalance(broker, [], [{ ...oldTx, postBalance: undefined }]),
  ).toBe(150);
  expect(accountBalance(broker, [oldEntry], [oldTx])).toBe(150);
  expect(bonusSummary(broker, [oldEntry], [oldTx])).toMatchObject({
    total: 150,
    netTurnover: 400,
    profit: 12,
    status: "active",
  });
  const entries = reconciledEntries(state);
  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({ opening: 150, cashFlow: 0 });
  expect(
    performance(entries[0].opening, entries[0].closing, entries[0].cashFlow)
      .pnl,
  ).toBe(0);
  expect(parseState(state)).toEqual(state);
});
