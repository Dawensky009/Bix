import { expect, it } from "vitest";
import {
  accountBalance,
  bonusSummary,
  deleteBroker,
  emptyState,
  parseState,
  reconciledEntries,
  saveBroker,
  saveEntry,
  saveTransaction,
  type Entry,
  type Transaction,
} from "./domain";
const b = {
  id: "b",
  name: "Broker",
  currency: "USD" as const,
  initialBalance: 150,
  ownDeposit: 100,
  bonusPercent: 50,
  turnoverRequired: 2000,
};
const e: Entry = {
  id: "e",
  brokerId: "b",
  date: "2024-01-02",
  opening: 150,
  closing: 180,
  cashFlow: 0,
  note: "",
  reconciled: true,
  netTurnover: 300,
  bonusProfit: 10,
};
const t: Transaction = {
  id: "t",
  brokerId: "b",
  date: "2024-01-02",
  amount: -10,
  bonusDeduction: 0,
  postBalance: 170,
  afterClose: true,
  order: 1,
  note: "",
  bonusStatus: "released",
};
it("deleting broker removes its transactions but preserves another broker", () => {
  const state = {
    ...emptyState,
    brokers: [b, { ...b, id: "other" }],
    transactions: [t, { ...t, id: "other", brokerId: "other" }],
  };
  expect(deleteBroker(state, "b").transactions).toEqual([
    { ...t, id: "other", brokerId: "other" },
  ]);
});
it("same-day bonus decisions follow explicit transaction order, not fetch order", () => {
  const later = {
    ...t,
    id: "later",
    order: 2,
    bonusStatus: "cancelled" as const,
    postBalance: 100,
  };
  expect(bonusSummary(b, [e], [later, t]).status).toBe("cancelled");
  expect(accountBalance(b, [e], [later, t])).toBe(100);
});
it("requires unique chronological order within a broker, date and phase on save, but preserves legacy imports", () => {
  const state = saveTransaction(saveBroker(emptyState, b), t);
  expect(() => saveTransaction(state, { ...t, id: "duplicate" })).toThrow(
    /order.*already/i,
  );
  expect(
    saveTransaction(state, { ...t, id: "other-phase", afterClose: false })
      .transactions,
  ).toHaveLength(2);
  expect(
    saveTransaction(state, { ...t, note: "edited" }).transactions,
  ).toHaveLength(1);
  expect(
    parseState({ ...state, transactions: [t, { ...t, id: "legacy" }] })
      .transactions,
  ).toHaveLength(2);
});
it("rejects malformed transactions instead of silently dropping backup data", () => {
  expect(() =>
    parseState({ ...emptyState, transactions: { bad: true } }),
  ).toThrow();
});
it("chronological entry edits and transaction edits recompute later opening and cashflow once", () => {
  let s = saveEntry(saveBroker(emptyState, b), e);
  s = saveTransaction(s, t);
  s = saveEntry(s, {
    ...e,
    id: "e2",
    date: "2024-01-03",
    closing: 190,
    netTurnover: 400,
  });
  s = saveEntry(s, { ...e, closing: 175 });
  s = saveTransaction(s, { ...t, amount: -15, postBalance: 160 });
  const later = reconciledEntries(s).find((x) => x.id === "e2")!;
  expect(later.opening).toBe(175);
  expect(later.cashFlow).toBe(-15);
  expect(bonusSummary(b, s.entries, s.transactions).netTurnover).toBe(400);
});
it("legacy entry cashflow remains authoritative, not added to transactions", () => {
  const legacy = { ...e, reconciled: undefined, cashFlow: 20 };
  const s = {
    ...emptyState,
    brokers: [b],
    entries: [legacy],
    transactions: [{ ...t, afterClose: false, amount: 20 }],
  };
  expect(reconciledEntries(s)[0]).toEqual(legacy);
  expect(accountBalance(b, s.entries, s.transactions)).toBe(180);
});
