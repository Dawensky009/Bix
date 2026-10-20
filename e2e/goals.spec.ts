import { test, expect } from "@playwright/test";
const fixture = {
  version: 1,
  brokers: [
    { id: "b", name: "Test account", currency: "USD", initialBalance: 1000 },
  ],
  entries: [
    {
      id: "e1",
      brokerId: "b",
      date: "2026-01-15",
      opening: 1000,
      closing: 1100,
      cashFlow: 0,
      note: "",
    },
    {
      id: "e2",
      brokerId: "b",
      date: "2026-01-16",
      opening: 1100,
      closing: 1210,
      cashFlow: 0,
      note: "",
    },
  ],
  goals: [],
};
test("set monthly goal and track profit against target", async ({ page }) => {
  await page.addInitScript(
    (state) => localStorage.setItem("bix.state.v1", JSON.stringify(state)),
    fixture,
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Goals", exact: true }).click();
  await page.getByRole("button", { name: "Set goal", exact: true }).click();
  await page.getByLabel("Goal period").selectOption("monthly");
  for (const [start, end] of [
    ["2024-01-31", "2024-02-29"],
    ["2023-01-31", "2023-02-28"],
    ["2024-12-31", "2025-01-31"],
    ["2026-10-19", "2026-11-19"],
  ]) {
    await page.getByLabel("Start date").fill(start);
    await expect(page.getByLabel("End date", { exact: true })).toHaveValue(end);
  }
  await page.getByLabel("Start date").fill("2026-01-15");
  await expect(page.getByLabel("End date", { exact: true })).toHaveValue(
    "2026-02-15",
  );
  await page.getByLabel("End date", { exact: true }).fill("2026-01-16");
  await page.getByLabel("Goal period").selectOption("weekly");
  await page.getByLabel("Start date").fill("2026-01-14");
  await expect(page.getByLabel("End date", { exact: true })).toHaveValue(
    "2026-01-16",
  );
  await page.getByLabel("Goal period").selectOption("monthly");
  await page.getByLabel("Start date").fill("2026-01-15");
  await expect(
    page.getByText("Start and end dates are inclusive. Choose any date range."),
  ).toBeVisible();
  await page.getByLabel("Profit target").fill("500");
  await page.getByRole("button", { name: "Save goal", exact: true }).click();
  await expect(page.getByTestId("goal-progress")).toContainText("42.0%");
  await expect(page.getByTestId("goal-progress")).toContainText("$210.00");
  await expect(page.getByTestId("goal-progress")).toContainText(
    "2026-01-15 → 2026-01-16",
  );
  await page.getByRole("button", { name: "Edit goal", exact: true }).click();
  await expect(page.getByLabel("End date", { exact: true })).toHaveValue(
    "2026-01-16",
  );
  await page.getByLabel("End date", { exact: true }).fill("2026-01-14");
  await page.getByRole("button", { name: "Save goal", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "End date must be on or after start date",
  );
  await page.getByLabel("End date", { exact: true }).fill("2026-01-15");
  await page.getByRole("button", { name: "Save goal", exact: true }).click();
  await expect(page.getByTestId("goal-progress")).toContainText("20.0%");
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("bix.state.v1")!).goals[0].end,
    ),
  ).toBe("2026-01-15");
  await page.getByRole("button", { name: "Forecast", exact: true }).click();
  await page.getByLabel("Future trading sessions").fill("2");
  await expect(page.getByTestId("projected-balance")).toHaveText("$1,464.10");
  await expect(page.getByText("Not a prediction or a promise.")).toBeVisible();
});
