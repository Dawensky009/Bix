import { test, expect } from "@playwright/test";

test("create a broker and persist it after reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add broker", exact: true }).click();
  await page.getByLabel("Broker name").fill("My trading account");
  await page.getByLabel("Initial balance").fill("1000");
  await page.getByRole("button", { name: "Save broker", exact: true }).click();
  await expect(page.getByLabel("Active broker")).toContainText(
    "My trading account",
  );
  await page.reload();
  await expect(page.getByLabel("Active broker")).toContainText(
    "My trading account",
  );
  await page.getByRole("button", { name: "New entry", exact: true }).click();
  await page.getByLabel("Entry date").fill("2026-01-15");
  await page.getByLabel("Opening balance").fill("1000");
  await page.getByLabel("Closing balance").fill("1250");
  await page.getByLabel("Net deposits / withdrawals").fill("200");
  await page.getByLabel("Trading notes").fill("Followed my risk plan.");
  await page.getByRole("button", { name: "Save entry", exact: true }).click();
  await expect(page.getByRole("row", { name: /2026-01-15/ })).toContainText(
    "$50.00",
  );
  await expect(page.getByRole("row", { name: /2026-01-15/ })).toContainText(
    "5.00%",
  );
  await page.reload();
  await expect(page.getByRole("row", { name: /2026-01-15/ })).toContainText(
    "$50.00",
  );
});
