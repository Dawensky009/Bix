import { test, expect } from "@playwright/test";
test("historical overflow does not hide finite independent scenario", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() =>
    localStorage.setItem(
      "bix.state.v1",
      JSON.stringify({
        version: 1,
        brokers: [
          {
            id: "b",
            name: "Overflow test",
            currency: "USD",
            initialBalance: 1,
          },
        ],
        entries: [
          {
            id: "a",
            brokerId: "b",
            date: "2025-01-01",
            opening: 0.01,
            closing: 1e12,
            cashFlow: 0,
            note: "",
          },
          {
            id: "c",
            brokerId: "b",
            date: "2025-01-02",
            opening: 0.01,
            closing: 1e12,
            cashFlow: 0,
            note: "",
          },
        ],
        goals: [],
      }),
    ),
  );
  await page.reload();
  await page.getByRole("button", { name: "Forecast", exact: true }).click();
  await page.getByLabel("Future trading sessions").fill("30");
  await page.getByLabel("Hypothetical return per session (%)").fill("0");
  await expect(page.getByRole("alert")).toContainText("overflow");
  const scenario = page
    .locator(".forecast-results article")
    .filter({ hasText: "Your hypothetical scenario" });
  await expect(scenario.locator("h2")).toHaveText("$1,000,000,000,000.00");
});
