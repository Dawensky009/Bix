import { test, expect, mockCloud } from "./fixtures";
test("existing EUR account starts from broker snapshot without historical profit", async ({
  page,
}) => {
  await mockCloud(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Add broker", exact: true }).click();
  await page.getByLabel("Broker name").fill("Existing EUR fixture");
  await page.getByLabel("Currency").selectOption("EUR");
  await page.getByLabel("Your deposit").fill("100");
  await page.getByLabel("Bonus percentage").fill("50");
  await page.getByLabel("Required turnover").fill("2000");
  await expect(page.getByLabel("Calculated initial total")).toHaveText(
    "€150.00",
  );
  await page
    .getByText("Already trading on this account?", { exact: true })
    .click();
  await page.getByLabel("Current broker balance").fill("182");
  await page.getByLabel("Snapshot date").fill("2024-01-01");
  await page.getByLabel("Initial cumulative net turnover").fill("400");
  await page.getByLabel("Initial broker bonus profit").fill("12");
  await page.getByRole("button", { name: "Save broker", exact: true }).click();
  await expect(page.getByTestId("free-balance")).toHaveText("€120.00");
  await expect(page.getByTestId("total-balance")).toHaveText("€182.00");
  await expect(page.locator(".balance-breakdown")).toContainText("€0.00");
  await page.reload();
  await expect(page.getByTestId("free-balance")).toHaveText("€120.00");
  await page.getByRole("button", { name: "New entry", exact: true }).click();
  await page.getByLabel("Entry date").fill("2024-01-01");
  await page.getByLabel("Closing balance").fill("190");
  await page.getByLabel("Cumulative net turnover").fill("500");
  await page.getByLabel("Broker bonus profit").fill("13");
  await page.getByLabel("Broker bonus confirmation").selectOption("released");
  await page.getByRole("button", { name: "Save entry", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "after the end-of-day snapshot date",
  );
  await page.getByLabel("Entry date").fill("2024-01-02");
  await page.getByRole("button", { name: "Save entry", exact: true }).click();
  await expect(page.getByTestId("free-balance")).toHaveText("€190.00");
  await expect(page.getByRole("row", { name: /2024-01-02/ })).toContainText(
    "€8.00",
  );
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete entry 2024-01-02" }).click();
  await expect(page.getByTestId("free-balance")).toHaveText("€120.00");
  await expect(page.getByTestId("bonus-progress")).toContainText("Active");
});
