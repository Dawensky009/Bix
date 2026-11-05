import { test, expect, mockCloud } from "./fixtures";
for (const width of [1440, 390])
  for (const theme of ["dark", "light"])
    test(`fixture review ${width} ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await mockCloud(page, {
        brokers: [
          {
            id: "b",
            name: "Review fixture · USD",
            currency: "USD",
            initialBalance: 1500,
            ownDeposit: 1000,
            bonusPercent: 50,
            turnoverRequired: 20000,
            currentBalance: 1675,
            initialNetTurnover: 8400,
            initialBonusProfit: 95,
          },
        ],
        entries: [
          {
            id: "e",
            brokerId: "b",
            date: "2024-01-15",
            opening: 1675,
            closing: 1740,
            cashFlow: 0,
            note: "Illustrative fixture, not live trading",
            netTurnover: 10200,
            bonusProfit: 110,
            reconciled: true,
          },
        ],
      });
      await page.addInitScript(
        (t) => localStorage.setItem("bix.theme", t),
        theme,
      );
      await page.goto("/");
      await expect(page.getByTestId("free-balance")).toHaveText("$1,130.00");
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(width);
      await page.screenshot({
        path: `.impeccable/review/${width}-${theme}.png`,
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "New entry", exact: true })
        .click();
      await expect(page.getByLabel("Entry date")).toBeFocused();
      await page.screenshot({
        path: `.impeccable/review/${width}-${theme}-entry.png`,
        fullPage: true,
      });
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
    });
