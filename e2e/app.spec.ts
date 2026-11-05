import { test, expect, mockCloud } from "./fixtures";
test("no-bonus account and journal persist", async ({ page }) => {
  await mockCloud(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Add broker", exact: true }).click();
  await page.getByLabel("Broker name").fill("Fixture account");
  await page.getByLabel("Your deposit").fill("1000");
  await page.getByRole("button", { name: "Save broker", exact: true }).click();
  await expect(page.getByTestId("free-balance")).toHaveText("$1,000.00");
  await page.getByRole("button", { name: "New entry", exact: true }).click();
  await page.getByLabel("Entry date").fill("2024-01-15");
  await page.getByLabel("Closing balance").fill("1050");
  await page.getByRole("button", { name: "Save entry", exact: true }).click();
  await expect(page.getByRole("row", { name: /2024-01-15/ })).toContainText(
    "$50.00",
  );
  await page.reload();
  await expect(page.getByRole("row", { name: /2024-01-15/ })).toContainText(
    "5.00%",
  );
});
