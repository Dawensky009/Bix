import { test, expect } from "@playwright/test";
const state = {
  version: 1,
  brokers: [
    {
      id: "b",
      name: "Integrity account",
      currency: "USD",
      initialBalance: 1000,
    },
  ],
  entries: [
    {
      id: "e",
      brokerId: "b",
      date: "2026-01-15",
      opening: 1000,
      closing: 1100,
      cashFlow: 0,
      note: "Existing day",
    },
  ],
  goals: [],
};
async function seed(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.evaluate(
    (s) => localStorage.setItem("bix.state.v1", JSON.stringify(s)),
    state,
  );
  await page.reload();
}
test("reject duplicate day, edit loss, delete entry", async ({ page }) => {
  await seed(page);
  await page.getByRole("button", { name: "New entry", exact: true }).click();
  await page.getByLabel("Entry date").fill("2026-01-15");
  await page.getByLabel("Closing balance").fill("1200");
  await page.getByRole("button", { name: "Save entry", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("already exists");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Edit entry 2026-01-15" }).click();
  await page.getByLabel("Closing balance").fill("900");
  await page.getByRole("button", { name: "Save entry", exact: true }).click();
  await expect(page.getByRole("row", { name: /2026-01-15/ })).toContainText(
    "-10.00%",
  );
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete entry 2026-01-15" }).click();
  await expect(page.getByRole("row", { name: /2026-01-15/ })).toHaveCount(0);
});
test("import valid backup and preserve it after reload", async ({ page }) => {
  await page.goto("/");
  page.once("dialog", (d) => d.accept());
  await page.getByLabel("Import backup").setInputFiles({
    name: "valid.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(state)),
  });
  await expect(page.getByLabel("Active broker")).toContainText(
    "Integrity account",
  );
  await page.reload();
  await expect(page.getByRole("row", { name: /2026-01-15/ })).toContainText(
    "$100.00",
  );
});
test("invalid stored data stays untouched until explicit recovery import", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("bix.state.v1", "broken"));
  await page.reload();
  await expect(page.getByRole("alert")).toContainText(
    "Original data has not been changed",
  );
  await expect(
    page.getByRole("button", { name: "Export raw backup" }),
  ).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("bix.state.v1"))).toBe(
    "broken",
  );
  page.once("dialog", (d) => d.accept());
  await page.getByLabel("Import backup").setInputFiles({
    name: "valid.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(state)),
  });
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByLabel("Active broker")).toContainText(
    "Integrity account",
  );
});
test("refuse overwriting a change from another tab", async ({
  page,
  context,
}) => {
  await seed(page);
  const other = await context.newPage();
  await other.goto("/");
  await other.evaluate(
    (s) =>
      localStorage.setItem(
        "bix.state.v1",
        JSON.stringify({
          ...s,
          goals: [
            {
              id: "g",
              brokerId: "b",
              period: "weekly",
              start: "2026-01-15",
              target: 500,
            },
          ],
        }),
      ),
    state,
  );
  await page.getByRole("button", { name: "New entry", exact: true }).click();
  await page.getByLabel("Entry date").fill("2026-01-16");
  await page.getByLabel("Closing balance").fill("1200");
  await page.getByRole("button", { name: "Save entry", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("another tab");
});
test("legacy goals retain deadlines on reload and edit", async ({ page }) => {
  await page.goto("/");
  const legacy = {
    ...state,
    goals: [
      {
        id: "month",
        brokerId: "b",
        period: "monthly",
        start: "2026-01-01",
        target: 200,
      },
      {
        id: "week",
        brokerId: "b",
        period: "weekly",
        start: "2026-01-15",
        target: 200,
      },
    ],
  };
  await page.evaluate(
    (s) => localStorage.setItem("bix.state.v1", JSON.stringify(s)),
    legacy,
  );
  await page.reload();
  await page.getByRole("button", { name: "Goals", exact: true }).click();
  await expect(
    page.getByTestId("goal-progress").filter({ hasText: "Monthly goal" }),
  ).toContainText("2026-01-01 → 2026-01-31");
  const weekly = page
    .getByTestId("goal-progress")
    .filter({ hasText: "Weekly goal" });
  await expect(weekly).toContainText("2026-01-15 → 2026-01-21");
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("bix.state.v1")!).goals,
    ),
  ).toEqual(legacy.goals);
  await weekly.getByRole("button", { name: "Edit goal" }).click();
  await expect(page.getByLabel("End date", { exact: true })).toHaveValue(
    "2026-01-21",
  );
  await page.getByRole("button", { name: "Save goal", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Goals", exact: true }).click();
  await expect(
    page.getByTestId("goal-progress").filter({ hasText: "Weekly goal" }),
  ).toContainText("2026-01-15 → 2026-01-21");
});
test("weekly goal and broker isolation", async ({ page }) => {
  await seed(page);
  await page.getByRole("button", { name: "Goals", exact: true }).click();
  await page.getByRole("button", { name: "Set goal", exact: true }).click();
  await page.getByLabel("Goal period").selectOption("weekly");
  await page.getByLabel("Start date").fill("2026-01-15");
  await expect(page.getByLabel("End date", { exact: true })).toHaveValue(
    "2026-01-21",
  );
  await page.getByLabel("Profit target").fill("200");
  await page.getByRole("button", { name: "Save goal", exact: true }).click();
  await expect(page.getByTestId("goal-progress")).toContainText("50.0%");
  await page.getByRole("button", { name: "Add broker", exact: true }).click();
  await page.getByLabel("Broker name").fill("Separate EUR");
  await page.getByLabel("Currency").selectOption("EUR");
  await page.getByLabel("Initial balance").fill("250");
  await page.getByRole("button", { name: "Save broker", exact: true }).click();
  await expect(page.getByTestId("goal-progress")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Daily journal", exact: true })
    .click();
  await expect(page.getByRole("row", { name: /2026-01-15/ })).toHaveCount(0);
});
