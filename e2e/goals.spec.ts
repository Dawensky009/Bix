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
  await page.getByLabel("Start date").fill("2026-01-01");
  await page.getByLabel("Profit target").fill("500");
  await page.getByRole("button", { name: "Save goal", exact: true }).click();
  await expect(page.getByTestId("goal-progress")).toContainText("42.0%");
  await expect(page.getByTestId("goal-progress")).toContainText("$210.00");
  await page.getByRole("button", { name: "Forecast", exact: true }).click();
  await page.getByLabel("Future trading sessions").fill("2");
  await expect(page.getByTestId("projected-balance")).toHaveText("$1,464.10");
  await expect(page.getByText("Not a prediction or a promise.")).toBeVisible();
});
