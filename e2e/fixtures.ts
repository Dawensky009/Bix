import { test as base, expect, type Page } from "@playwright/test";
import type { State } from "../src/domain";
// Isolated simulated Supabase only. No account, credential, or remote write.
export async function mockCloud(page: Page, seed?: Partial<State>) {
  const rows: Record<string, Record<string, unknown>[]> = {
    brokers: [],
    entries: [],
    goals: [],
    transactions: [],
  };
  const names: Record<string, string> = {
    initialBalance: "initial_balance",
    ownDeposit: "own_deposit",
    bonusPercent: "bonus_percent",
    turnoverRequired: "turnover_required",
    initialNetTurnover: "initial_net_turnover",
    initialBonusProfit: "initial_bonus_profit",
    currentBalance: "current_balance",
    baselineDate: "baseline_date",
    brokerId: "broker_id",
    cashFlow: "cash_flow",
    netTurnover: "net_turnover",
    bonusProfit: "bonus_profit",
    bonusStatus: "bonus_status",
    bonusDeduction: "bonus_deduction",
    postBalance: "post_balance",
    afterClose: "after_close",
    order: "sort_order",
    start: "start_date",
    end: "end_date",
  };
  for (const table of Object.keys(rows))
    rows[table] = (
      (seed?.[table as keyof State] as unknown as Record<string, unknown>[]) ??
      []
    ).map((r) =>
      Object.fromEntries(Object.entries(r).map(([k, v]) => [names[k] ?? k, v])),
    );
  await page.addInitScript(() => {
    localStorage.setItem(
      "sb-bix-fixture-auth-token",
      JSON.stringify({
        access_token: "fixture-access-token",
        refresh_token: "fixture-refresh-token",
        token_type: "bearer",
        expires_at: 4102444800,
        user: {
          id: "fixture-user",
          email: "fixture@example.invalid",
          aud: "authenticated",
          app_metadata: {},
          user_metadata: {},
          created_at: "2024-01-01T00:00:00Z",
        },
      }),
    );
  });
  await page.route("https://**.supabase.co/**", async (route) => {
    const url = new URL(route.request().url());
    const table = url.pathname.split("/").at(-1)!;
    if (url.hostname !== "bix-fixture.supabase.co") return route.abort();
    if (table === "bix_replace_state") {
      Object.assign(rows, route.request().postDataJSON().payload);
      return route.fulfill({ status: 200, json: null });
    }
    if (!rows[table]) return route.fulfill({ status: 200, json: {} });
    const method = route.request().method();
    const matches = (r: Record<string, unknown>) =>
      [...url.searchParams]
        .filter(([k]) => !["select", "on_conflict"].includes(k))
        .every(
          ([k, v]) =>
            k === "user_id" || String(r[k]) === v.replace(/^eq\./, ""),
        );
    if (method === "DELETE")
      rows[table] = rows[table].filter((r) => !matches(r));
    if (method === "POST" || method === "PATCH") {
      const body = route.request().postDataJSON();
      for (const r of Array.isArray(body) ? body : [body])
        rows[table] = [...rows[table].filter((old) => old.id !== r.id), r];
    }
    await route.fulfill({
      status: 200,
      json: method === "GET" ? rows[table].filter(matches) : rows[table],
    });
  });
  return rows;
}
export const test = base;
export { expect };
