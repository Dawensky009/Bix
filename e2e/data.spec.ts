import { test, expect } from "@playwright/test";

test("manage brokers, isolate accounts and export a backup", async ({
  page,
}) => {
  await page.goto("/");
  for (const name of ["First account", "Second account"]) {
    await page.getByRole("button", { name: "Add broker", exact: true }).click();
    await page.getByLabel("Broker name").fill(name);
    await page.getByLabel("Initial balance").fill("1000");
    await page
      .getByRole("button", { name: "Save broker", exact: true })
      .click();
  }
  await page
    .getByRole("button", { name: "Manage broker", exact: true })
    .click();
  await page.getByLabel("Broker name").fill("Renamed account");
  await page.getByRole("button", { name: "Save broker", exact: true }).click();
  await expect(page.getByLabel("Active broker")).toContainText(
    "Renamed account",
  );
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export backup", exact: true })
    .click();
  expect((await download).suggestedFilename()).toMatch(/bix.*json/);
  await page
    .getByRole("button", { name: "Manage broker", exact: true })
    .click();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Delete broker", exact: true })
    .click();
  await expect(page.getByLabel("Active broker")).not.toContainText(
    "Renamed account",
  );
  await expect(page.getByLabel("Active broker")).toContainText("First account");
});

test("reject invalid backup without overwriting data", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Import backup").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":99}'),
  });
  await expect(page.getByRole("alert")).toContainText("version");
  expect(
    await page.evaluate(() => localStorage.getItem("bix.state.v1")),
  ).toBeNull();
});
