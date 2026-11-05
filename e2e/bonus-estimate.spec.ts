import { test, expect, mockCloud } from "./fixtures";
import { readFile } from "node:fs/promises";

test("estimated losses are bounded and explicitly distinguished from broker readings", async ({
  page,
}) => {
  await mockCloud(page, {
    brokers: [
      {
        id: "b",
        name: "Loss fixture",
        currency: "USD",
        initialBalance: 150,
        ownDeposit: 100,
        bonusPercent: 50,
        turnoverRequired: 2000,
      },
    ],
    entries: [
      {
        id: "manual",
        brokerId: "b",
        date: "2024-01-02",
        opening: 150,
        closing: 200,
        cashFlow: 0,
        note: "",
        bonusProfit: 0,
        reconciled: true,
      },
      {
        id: "auto",
        brokerId: "b",
        date: "2024-01-03",
        opening: 200,
        closing: 20,
        cashFlow: 0,
        note: "",
        reconciled: true,
      },
    ],
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Estimated free balance", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("row", { name: /2024-01-03/ })).toContainText(
    "Estimated bonus profit: -$50.00",
  );
  await expect(page.getByTestId("free-balance")).toHaveText("$20.00");
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export backup", exact: true })
    .click();
  const filePath = await (await downloaded).path();
  expect(filePath).not.toBeNull();
  const bytes = await readFile(filePath!);
  const backup = JSON.parse(bytes.toString());
  expect(
    backup.entries.find((e: { id: string }) => e.id === "manual").bonusProfit,
  ).toBe(0);
  expect(
    backup.entries.find((e: { id: string }) => e.id === "auto"),
  ).not.toHaveProperty("bonusProfit");
  for (const e of backup.entries)
    expect(e).not.toHaveProperty("estimatedBonusProfit");
  page.once("dialog", (d) => d.accept());
  const restored = page.waitForResponse(
    (r) =>
      r.url().endsWith("/rpc/bix_replace_state") &&
      r.request().method() === "POST",
  );
  await page.getByLabel("Import backup").setInputFiles({
    name: "bonus.json",
    mimeType: "application/json",
    buffer: bytes,
  });
  expect((await restored).ok()).toBeTruthy();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("row", { name: /2024-01-02/ })).toContainText(
    "Broker-reported bonus profit: $0.00",
  );
  await expect(page.getByRole("row", { name: /2024-01-03/ })).toContainText(
    "Estimated bonus profit: -$50.00",
  );
});

test("automatic bonus profit and manual broker overrides persist independently", async ({
  page,
}) => {
  const rows = await mockCloud(page, {
    brokers: [
      {
        id: "b",
        name: "Estimate fixture",
        currency: "USD",
        initialBalance: 150,
        ownDeposit: 100,
        bonusPercent: 50,
        turnoverRequired: 2000,
        currentBalance: 182,
        initialBonusProfit: 12,
        baselineDate: "2024-01-01",
      },
    ],
  });
  await page.goto("/");
  await expect(page.getByTestId("free-balance")).toHaveText("$120.00");
  await page.getByRole("button", { name: "New entry", exact: true }).click();
  await page.getByLabel("Entry date").fill("2024-01-02");
  await page.getByLabel("Closing balance").fill("200");
  await page.getByLabel("Cumulative net turnover").fill("500");
  await page.getByRole("button", { name: "Save entry", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("free-balance")).toHaveText("$132.00");
  await expect(
    page.getByRole("heading", { name: "Estimated free balance", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("row", { name: /2024-01-02/ })).toContainText(
    "Estimated bonus profit: $18.00",
  );
  expect(rows.entries[0].bonus_profit).toBeNull();
  await page.reload();
  await expect(page.getByTestId("free-balance")).toHaveText("$132.00");
  await page
    .getByRole("button", { name: "Edit entry 2024-01-02", exact: true })
    .click();
  await expect(
    page.getByLabel("Broker bonus profit", { exact: false }),
  ).toHaveValue("");
  await page.getByLabel("Broker bonus profit", { exact: false }).fill("19");
  await page.getByRole("button", { name: "Save entry", exact: true }).click();
  await expect(page.getByTestId("free-balance")).toHaveText("$131.00");
  expect(rows.entries[0].bonus_profit).toBe(19);
  await page.reload();
  await expect(page.getByRole("row", { name: /2024-01-02/ })).toContainText(
    "Broker-reported bonus profit: $19.00",
  );
  await page
    .getByRole("button", { name: "Edit entry 2024-01-02", exact: true })
    .click();
  await expect(
    page.getByLabel("Broker bonus profit", { exact: false }),
  ).toHaveValue("19");
  await page.getByLabel("Broker bonus profit", { exact: false }).fill("0");
  await page.getByRole("button", { name: "Save entry", exact: true }).click();
  await expect(page.getByTestId("free-balance")).toHaveText("$150.00");
  expect(rows.entries[0].bonus_profit).toBe(0);
  await page
    .getByRole("button", { name: "Edit entry 2024-01-02", exact: true })
    .click();
  await page.getByLabel("Broker bonus profit", { exact: false }).fill("");
  await page.getByRole("button", { name: "Save entry", exact: true }).click();
  await expect(page.getByTestId("free-balance")).toHaveText("$132.00");
  expect(rows.entries[0].bonus_profit).toBeNull();
  await page.reload();
  await expect(page.getByTestId("free-balance")).toHaveText("$132.00");
});
