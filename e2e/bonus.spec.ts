import { test, expect, mockCloud } from "./fixtures";
test("bonus onboarding persists, journal copies cumulative turnover, withdrawal cancels without loss", async ({
  page,
}) => {
  await mockCloud(page);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your edge starts here." }),
  ).toBeVisible();
  await page.screenshot({
    path: ".impeccable/review/before-desktop.png",
    fullPage: true,
  });
  await expect(
    page.getByRole("button", { name: "Forecast", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Add broker", exact: true }).click();
  await page.getByLabel("Broker name").fill("Fixture · bonus account");
  await page.getByLabel("Your deposit").fill("100");
  await page.getByLabel("Bonus percentage").fill("50");
  await page.getByLabel("Required turnover").fill("2000");
  await expect(page.getByLabel("Calculated initial total")).toHaveText(
    "$150.00",
  );
  await page.getByRole("button", { name: "Save broker", exact: true }).click();
  await expect(page.getByTestId("free-balance")).toHaveText("$100.00");
  await expect(page.getByTestId("total-balance")).toHaveText("$150.00");
  await page.reload();
  await expect(page.getByTestId("free-balance")).toHaveText("$100.00");
  await page.getByRole("button", { name: "New entry", exact: true }).click();
  await page.getByLabel("Entry date").fill("2024-01-02");
  await page.getByLabel("Closing balance").fill("200");
  await page.getByLabel("Cumulative net turnover").fill("2200");
  await page.getByLabel("Broker bonus profit").fill("19");
  await page.getByRole("button", { name: "Save entry", exact: true }).click();
  await expect(page.getByTestId("free-balance")).toHaveText("$131.00");
  await expect(page.getByTestId("bonus-progress")).toContainText(
    "Broker confirmation required",
  );
  await page.getByRole("button", { name: "Transaction", exact: true }).click();
  await page.getByLabel("Date", { exact: true }).fill("2024-01-02");
  await page.getByLabel("Amount (USD)").fill("20");
  await page.getByLabel("Exact bonus deduction").fill("69");
  await page.getByLabel("Balance after transaction").fill("111");
  await page.getByLabel("Broker bonus decision").selectOption("cancelled");
  await page.getByLabel("Transaction timing").selectOption("after");
  await page
    .getByRole("button", { name: "Save transaction", exact: true })
    .click();
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "Withdrawal" })
      .getByRole("cell")
      .nth(4),
  ).toHaveText("—");
  await expect(page.getByTestId("free-balance")).toHaveText("$111.00");
  await page.reload();
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "Withdrawal" })
      .getByRole("cell")
      .nth(4),
  ).toHaveText("—");
  await expect(page.getByTestId("free-balance")).toHaveText("$111.00");
  await expect(page.getByTestId("bonus-progress")).toContainText("Cancelled");
  await page.getByRole("button", { name: "New entry", exact: true }).click();
  await page.getByLabel("Entry date").fill("2024-01-03");
  await page.getByLabel("Closing balance").fill("121");
  await page.getByLabel("Cumulative net turnover").fill("2200");
  await page.getByLabel("Broker bonus profit").fill("19");
  await page.getByRole("button", { name: "Save entry", exact: true }).click();
  await expect(page.getByRole("row", { name: /2024-01-03/ })).toContainText(
    "$10.00",
  );
  await expect(page.getByTestId("free-balance")).toHaveText("$121.00");
});
