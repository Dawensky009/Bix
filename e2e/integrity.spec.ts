import { test, expect, mockCloud } from "./fixtures";
const seed = {
  brokers: [
    {
      id: "b",
      name: "Integrity fixture",
      currency: "USD" as const,
      initialBalance: 1000,
    },
  ],
  entries: [
    {
      id: "e",
      brokerId: "b",
      date: "2024-01-15",
      opening: 1000,
      closing: 1100,
      cashFlow: 0,
      note: "Legacy fixture",
    },
  ],
};
test("duplicate date retains form; edit and delete legacy entry", async ({
  page,
}) => {
  await mockCloud(page, seed);
  await page.goto("/");
  await page.getByRole("button", { name: "New entry", exact: true }).click();
  await page.getByLabel("Entry date").fill("2024-01-15");
  await page.getByLabel("Closing balance").fill("1200");
  await page.getByRole("button", { name: "Save entry", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("already exists");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Edit entry 2024-01-15" }).click();
  await page.getByLabel("Closing balance").fill("900");
  await page.getByRole("button", { name: "Save entry", exact: true }).click();
  await expect(page.getByRole("row", { name: /2024-01-15/ })).toContainText(
    "-10.00%",
  );
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete entry 2024-01-15" }).click();
  await expect(page.getByRole("row", { name: /2024-01-15/ })).toHaveCount(0);
});
test("legacy v1 backup restores via atomic RPC and preserves browser legacy bytes", async ({
  page,
}) => {
  await mockCloud(page);
  await page.addInitScript(() =>
    localStorage.setItem("bix.state.v1", "legacy-original-bytes"),
  );
  await page.goto("/");
  page.once("dialog", (d) => d.accept());
  await page.getByLabel("Import backup").setInputFiles({
    name: "v1.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ version: 1, ...seed, goals: [] })),
  });
  await expect(page.getByLabel("Active broker")).toContainText(
    "Integrity fixture",
  );
  await page.reload();
  await expect(page.getByRole("row", { name: /2024-01-15/ })).toContainText(
    "$100.00",
  );
  expect(await page.evaluate(() => localStorage.getItem("bix.state.v1"))).toBe(
    "legacy-original-bytes",
  );
});
test("failed cloud save retains input", async ({ page }) => {
  await mockCloud(page);
  await page.route("**/rest/v1/brokers*", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 400,
          json: { message: "Migration required: own_deposit column missing" },
        })
      : route.fallback(),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Add broker", exact: true }).click();
  await page.getByLabel("Broker name").fill("Keep this input");
  await page.getByLabel("Your deposit").fill("100");
  await page.getByRole("button", { name: "Save broker", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Migration required");
  await expect(page.getByLabel("Broker name")).toHaveValue("Keep this input");
  await expect(page.getByLabel("Active broker")).not.toContainText(
    "Keep this input",
  );
});
