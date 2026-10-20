import { supabase } from "./supabase";
import type { Broker, Entry, Goal, Transaction, State } from "./domain";
import { emptyState } from "./domain";

// ── Row ↔ domain mappers ──────────────────────────────────────────────────────

function rowToBroker(r: Record<string, unknown>): Broker {
  return {
    id: r.id as string,
    name: r.name as string,
    currency: r.currency as Broker["currency"],
    initialBalance: r.initial_balance as number,
  };
}
function brokerToRow(uid: string, b: Broker) {
  return { id: b.id, user_id: uid, name: b.name, currency: b.currency, initial_balance: b.initialBalance };
}

function rowToEntry(r: Record<string, unknown>): Entry {
  return {
    id: r.id as string,
    brokerId: r.broker_id as string,
    date: r.date as string,
    opening: r.opening as number,
    closing: r.closing as number,
    cashFlow: r.cash_flow as number,
    note: (r.note ?? "") as string,
  };
}
function entryToRow(uid: string, e: Entry) {
  return { id: e.id, user_id: uid, broker_id: e.brokerId, date: e.date, opening: e.opening, closing: e.closing, cash_flow: e.cashFlow, note: e.note };
}

function rowToGoal(r: Record<string, unknown>): Goal {
  return {
    id: r.id as string,
    brokerId: r.broker_id as string,
    period: r.period as Goal["period"],
    start: r.start_date as string,
    end: (r.end_date ?? undefined) as string | undefined,
    target: r.target as number,
  };
}
function goalToRow(uid: string, g: Goal) {
  return { id: g.id, user_id: uid, broker_id: g.brokerId, period: g.period, start_date: g.start, end_date: g.end ?? null, target: g.target };
}

function rowToTx(r: Record<string, unknown>): Transaction {
  return {
    id: r.id as string,
    brokerId: r.broker_id as string,
    date: r.date as string,
    amount: r.amount as number,
    note: (r.note ?? "") as string,
  };
}
function txToRow(uid: string, t: Transaction) {
  return { id: t.id, user_id: uid, broker_id: t.brokerId, date: t.date, amount: t.amount, note: t.note };
}

// ── Fetch all data for a user ─────────────────────────────────────────────────

export async function fetchState(userId: string): Promise<State> {
  const [bRes, eRes, gRes, tRes] = await Promise.all([
    supabase.from("brokers").select("*").eq("user_id", userId),
    supabase.from("entries").select("*").eq("user_id", userId),
    supabase.from("goals").select("*").eq("user_id", userId),
    supabase.from("transactions").select("*").eq("user_id", userId),
  ]);
  if (bRes.error) throw bRes.error;
  if (eRes.error) throw eRes.error;
  if (gRes.error) throw gRes.error;
  if (tRes.error) throw tRes.error;
  return {
    ...emptyState,
    brokers: (bRes.data ?? []).map(rowToBroker),
    entries: (eRes.data ?? []).map(rowToEntry),
    goals: (gRes.data ?? []).map(rowToGoal),
    transactions: (tRes.data ?? []).map(rowToTx),
  };
}

// ── Individual write operations ───────────────────────────────────────────────

export async function dbUpsertBroker(uid: string, b: Broker) {
  const { error } = await supabase.from("brokers").upsert(brokerToRow(uid, b));
  if (error) throw error;
}
export async function dbDeleteBroker(uid: string, id: string) {
  // Delete dependents first (no CASCADE defined in schema)
  await supabase.from("transactions").delete().eq("broker_id", id).eq("user_id", uid);
  await supabase.from("goals").delete().eq("broker_id", id).eq("user_id", uid);
  await supabase.from("entries").delete().eq("broker_id", id).eq("user_id", uid);
  const { error } = await supabase.from("brokers").delete().eq("id", id).eq("user_id", uid);
  if (error) throw error;
}

export async function dbUpsertEntry(uid: string, e: Entry) {
  const { error } = await supabase.from("entries").upsert(entryToRow(uid, e));
  if (error) throw error;
}
export async function dbDeleteEntry(uid: string, id: string) {
  const { error } = await supabase.from("entries").delete().eq("id", id).eq("user_id", uid);
  if (error) throw error;
}

export async function dbUpsertGoal(uid: string, g: Goal) {
  const { error } = await supabase.from("goals").upsert(goalToRow(uid, g));
  if (error) throw error;
}
export async function dbDeleteGoal(uid: string, id: string) {
  const { error } = await supabase.from("goals").delete().eq("id", id).eq("user_id", uid);
  if (error) throw error;
}

export async function dbUpsertTransaction(uid: string, t: Transaction) {
  const { error } = await supabase.from("transactions").upsert(txToRow(uid, t));
  if (error) throw error;
}
export async function dbDeleteTransaction(uid: string, id: string) {
  const { error } = await supabase.from("transactions").delete().eq("id", id).eq("user_id", uid);
  if (error) throw error;
}

// ── Typed write descriptor (used by commit) ───────────────────────────────────

export type DbWrite =
  | { kind: "broker"; broker: Broker }
  | { kind: "broker-del"; id: string }
  | { kind: "entry"; entry: Entry }
  | { kind: "entry-del"; id: string }
  | { kind: "goal"; goal: Goal }
  | { kind: "goal-del"; id: string }
  | { kind: "tx"; tx: Transaction }
  | { kind: "tx-del"; id: string };

export async function executeWrite(userId: string, write: DbWrite): Promise<void> {
  switch (write.kind) {
    case "broker":     return dbUpsertBroker(userId, write.broker);
    case "broker-del": return dbDeleteBroker(userId, write.id);
    case "entry":      return dbUpsertEntry(userId, write.entry);
    case "entry-del":  return dbDeleteEntry(userId, write.id);
    case "goal":       return dbUpsertGoal(userId, write.goal);
    case "goal-del":   return dbDeleteGoal(userId, write.id);
    case "tx":         return dbUpsertTransaction(userId, write.tx);
    case "tx-del":     return dbDeleteTransaction(userId, write.id);
  }
}

// ── Bulk import (for backup restore) ─────────────────────────────────────────

export async function dbImportAll(userId: string, s: State): Promise<void> {
  // Delete existing data, then insert new
  await supabase.from("transactions").delete().eq("user_id", userId);
  await supabase.from("goals").delete().eq("user_id", userId);
  await supabase.from("entries").delete().eq("user_id", userId);
  await supabase.from("brokers").delete().eq("user_id", userId);

  if (s.brokers.length) {
    const { error } = await supabase.from("brokers").insert(s.brokers.map((b) => brokerToRow(userId, b)));
    if (error) throw error;
  }
  if (s.entries.length) {
    const { error } = await supabase.from("entries").insert(s.entries.map((e) => entryToRow(userId, e)));
    if (error) throw error;
  }
  if (s.goals.length) {
    const { error } = await supabase.from("goals").insert(s.goals.map((g) => goalToRow(userId, g)));
    if (error) throw error;
  }
  if (s.transactions.length) {
    const { error } = await supabase.from("transactions").insert(s.transactions.map((t) => txToRow(userId, t)));
    if (error) throw error;
  }
}
