import { test, expect } from "@playwright/test";
test("production PWA caches its shell and saves a journal entry offline", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  const manifest = await page.evaluate(async () => {
    const href = document.querySelector<HTMLLinkElement>(
      'link[rel="manifest"]',
    )!.href;
    return (await fetch(href)).json();
  });
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons).toHaveLength(2);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Your edge starts here." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add broker", exact: true }).click();
  await page.getByLabel("Broker name").fill("Offline account");
  await page.getByLabel("Initial balance").fill("500");
  await page.getByRole("button", { name: "Save broker", exact: true }).click();
  await page.getByRole("button", { name: "New entry", exact: true }).click();
  await page.getByLabel("Entry date").fill("2026-01-01");
  await page.getByLabel("Closing balance").fill("525");
  await page.getByRole("button", { name: "Save entry", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("row", { name: /2026-01-01/ })).toContainText(
    "$25.00",
  );
});

test("mobile layout and keyboard dialog dismissal", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Add broker", exact: true }).click();
  await expect(page.getByLabel("Broker name")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Goals", exact: true }),
  ).toBeVisible();
});
