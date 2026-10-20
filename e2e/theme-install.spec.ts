import { test, expect } from "@playwright/test";
test("install action provides browser instructions when prompt is absent", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Install BIX", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Install BIX" })).toBeVisible();
  await expect(
    page.getByText("Add to Home Screen", { exact: false }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("native install prompt is used only after user click", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    const e = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(e, {
      prompt: async () => {
        document.documentElement.dataset.promptUsed = "yes";
      },
      userChoice: Promise.resolve({ outcome: "accepted", platform: "web" }),
    });
    window.dispatchEvent(e);
  });
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-prompt-used",
    "yes",
  );
  await page.getByRole("button", { name: "Install BIX", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-prompt-used", "yes");
  await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
  await expect(page.getByText("App installed", { exact: true })).toBeVisible();
});

test("theme switches all surfaces and persists across reload", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your edge starts here." }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
