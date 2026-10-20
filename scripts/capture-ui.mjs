import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
const output = process.env.BIX_SCREENSHOTS;
if (!output)
  throw new Error("Set BIX_SCREENSHOTS to the screenshot output directory.");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "msedge" });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:4174");
  // Explicit visual-test fixture, never shipped or inserted into the user workspace.
  await page.evaluate(() => {
    const relativeDate = (offset) => {
      const date = new Date();
      date.setDate(date.getDate() + offset);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    };
    localStorage.setItem(
      "bix.state.v1",
      JSON.stringify({
        version: 1,
        brokers: [
          {
            id: "visual",
            name: "Visual test account",
            currency: "USD",
            initialBalance: 10000,
          },
        ],
        entries: [
          {
            id: "1",
            brokerId: "visual",
            date: relativeDate(-3),
            opening: 10000,
            closing: 10150,
            cashFlow: 0,
            note: "Test fixture: followed the plan",
          },
          {
            id: "2",
            brokerId: "visual",
            date: relativeDate(-2),
            opening: 10150,
            closing: 10090,
            cashFlow: 0,
            note: "Test fixture: limited the loss",
          },
          {
            id: "3",
            brokerId: "visual",
            date: relativeDate(-1),
            opening: 10090,
            closing: 10340,
            cashFlow: 0,
            note: "Test fixture: patient execution",
          },
        ],
        goals: [
          {
            id: "g",
            brokerId: "visual",
            period: "monthly",
            start: relativeDate(-3),
            end: relativeDate(27),
            target: 750,
          },
        ],
      }),
    );
  });
  await page.reload();
  for (const theme of ["dark", "light"]) {
    await page.evaluate((t) => {
      localStorage.setItem("bix.theme", t);
    }, theme);
    await page.reload();
    for (const [name, width, height] of [
      ["desktop", 1440, 1000],
      ["mobile", 390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      await page.screenshot({
        path: resolve(output, `${theme}-${name}.png`),
        fullPage: true,
      });
      console.log(
        name,
        await page.evaluate(() => ({
          width: innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
        })),
      );
    }
  }
  console.log("Browser errors:", errors);
  if (errors.length) process.exitCode = 1;
} finally {
  await browser.close();
}
