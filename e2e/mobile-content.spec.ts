import { test, expect } from "@playwright/test";
test("populated mobile dashboard contains horizontal scrolling inside table", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.evaluate(() =>
    localStorage.setItem(
      "bix.state.v1",
      JSON.stringify({
        version: 1,
        brokers: [
          {
            id: "b",
            name: "Visual test account",
            currency: "USD",
            initialBalance: 10000,
          },
        ],
        entries: [
          {
            id: "e",
            brokerId: "b",
            date: "2025-01-01",
            opening: 10000,
            closing: 10340,
            cashFlow: 0,
            note: "Test fixture: followed plan",
          },
        ],
        goals: [
          {
            id: "g",
            brokerId: "b",
            period: "monthly",
            start: "2025-01-01",
            end: "9999-12-31",
            target: 750,
          },
        ],
      }),
    ),
  );
  await page.reload();

  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
});
