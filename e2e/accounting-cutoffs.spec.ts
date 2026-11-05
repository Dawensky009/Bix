import { test, expect, mockCloud } from "./fixtures";

test("dated imported snapshot excludes historical activity and rejects old transactions", async ({
  page,
}) => {
  const rows = await mockCloud(page, {
    brokers: [
      {
        id: "b",
        name: "Dated snapshot",
        currency: "USD",
        initialBalance: 100,
        currentBalance: 150,
        baselineDate: "2024-01-02",
        ownDeposit: 50,
        bonusPercent: 100,
        turnoverRequired: 1000,
        initialNetTurnover: 400,
        initialBonusProfit: 12,
      },
    ],
    entries: [
      {
        id: "old-e",
        brokerId: "b",
        date: "2024-01-02",
        opening: 100,
        closing: 999,
        cashFlow: 0,
        note: "Old reading",
        netTurnover: 999,
        bonusProfit: 999,
        bonusStatus: "released",
      },
    ],
    transactions: [
      {
        id: "old-t",
        brokerId: "b",
        date: "2024-01-02",
        amount: 50,
        note: "Old deposit",
        afterClose: true,
        bonusStatus: "cancelled",
      },
    ],
  });
  await page.goto("/");
  await expect(page.getByTestId("total-balance")).toHaveText("$150.00");
  await expect(page.getByTestId("free-balance")).toHaveText("$88.00");
  await expect(page.getByTestId("bonus-progress")).toContainText("$400.00");
  await expect(page.getByTestId("bonus-progress")).toContainText("Active");
  await expect(page.locator("tbody tr")).toHaveCount(0);
  await page.getByRole("button", { name: "Transaction", exact: true }).click();
  await page.getByLabel("Date", { exact: true }).fill("2024-01-02");
  await page.getByLabel("Amount (USD)").fill("10");
  await page.getByLabel("Balance after transaction").fill("140");
  await page
    .getByRole("button", { name: "Save transaction", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "after the end-of-day snapshot date",
  );
  expect(rows.transactions).toHaveLength(1);
  await page.getByLabel("Date", { exact: true }).fill("2024-01-03");
  await page
    .getByRole("button", { name: "Save transaction", exact: true })
    .click();
  await expect(page.getByTestId("total-balance")).toHaveText("$140.00");
  await page.getByRole("button", { name: "New entry", exact: true }).click();
  await page.getByLabel("Entry date").fill("2024-01-04");
  await page.getByLabel("Closing balance").fill("140");
  await page.getByLabel("Cumulative net turnover").fill("400");
  await page.getByLabel("Broker bonus profit").fill("12");
  await page.getByRole("button", { name: "Save entry", exact: true }).click();
  await expect(
    page
      .getByRole("row", { name: /2024-01-04/ })
      .getByRole("cell")
      .nth(4),
  ).toHaveText("$0.00");
  await page.reload();
  await expect(page.getByTestId("total-balance")).toHaveText("$140.00");
  expect(rows.entries).toHaveLength(2); // history retained, never deleted by the cutoff
});

test("backfilled same-day transaction uses editable chronology for balance and bonus status", async ({
  page,
}) => {
  await mockCloud(page, {
    brokers: [
      {
        id: "b",
        name: "Chronology",
        currency: "USD",
        initialBalance: 100,
        ownDeposit: 50,
        bonusPercent: 100,
        turnoverRequired: 1000,
      },
    ],
  });
  await page.goto("/");
  await expect(page.getByTestId("total-balance")).toHaveText("$100.00");
  await page.getByRole("button", { name: "Transaction", exact: true }).click();
  await page.getByLabel("Date", { exact: true }).fill("2024-01-02");
  await page.getByLabel("Amount (USD)").fill("10");
  await page.getByLabel("Chronological order").fill("20");
  await page.getByLabel("Balance after transaction").fill("110");
  await page.getByLabel("Broker bonus decision").selectOption("cancelled");
  await page
    .getByRole("button", { name: "Save transaction", exact: true })
    .click();
  await expect(page.getByTestId("total-balance")).toHaveText("$110.00");
  await page.getByRole("button", { name: "Transaction", exact: true }).click();
  await page.getByRole("button", { name: "Deposit", exact: true }).click();
  await page.getByLabel("Date", { exact: true }).fill("2024-01-02");
  await page.getByLabel("Amount (USD)").fill("20");
  await page.getByLabel("Chronological order").fill("20");
  await page.getByLabel("Balance after transaction").fill("120");
  await page.getByLabel("Broker bonus decision").selectOption("released");
  await page
    .getByRole("button", { name: "Save transaction", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "order is already",
  );
  await page.getByLabel("Chronological order").fill("10");
  await page
    .getByRole("button", { name: "Save transaction", exact: true })
    .click();
  await expect(page.getByTestId("total-balance")).toHaveText("$110.00");
  await expect(page.getByTestId("bonus-progress")).toContainText("Cancelled");
  await page.reload();
  await expect(page.getByTestId("total-balance")).toHaveText("$110.00");
  await expect(page.getByTestId("bonus-progress")).toContainText("Cancelled");
  await page
    .getByRole("row")
    .filter({ hasText: "Deposit" })
    .getByRole("button", { name: "Edit transaction 2024-01-02" })
    .click();
  await expect(page.getByLabel("Chronological order")).toHaveValue("10");
  await page.getByLabel("Chronological order").fill("30");
  await page
    .getByRole("button", { name: "Save transaction", exact: true })
    .click();
  await expect(page.getByTestId("total-balance")).toHaveText("$120.00");
  await expect(page.getByTestId("bonus-progress")).toContainText("Released");
  await expect(page.locator("tbody tr").first()).toContainText("Deposit");
});
