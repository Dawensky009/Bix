import { test, expect, mockCloud } from "./fixtures";
test("cloud outage surfaces an error", async ({ page }) => {
  test.setTimeout(45000);
  await mockCloud(page);
  await page.route("**/rest/v1/**", (route) =>
    route.abort("internetdisconnected"),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toBeVisible({ timeout: 35000 });
});
test("PWA manifest and cached shell remain installable", async ({ page }) => {
  await mockCloud(page);
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  const manifest = await page.evaluate(async () => {
    const href = document.querySelector<HTMLLinkElement>(
      'link[rel="manifest"]',
    )!.href;
    return (await fetch(href)).json();
  });
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons).toHaveLength(2);
});
