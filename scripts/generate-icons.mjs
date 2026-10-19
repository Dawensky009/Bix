// Render the source SVG with a real browser; no runtime image dependency.
import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
const browser = await chromium.launch({ channel: "msedge" });
try {
  const page = await browser.newPage();
  const svg = await readFile(
    new URL("../public/icon.svg", import.meta.url),
    "utf8",
  );
  for (const size of [192, 512]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<style>body{margin:0}svg{width:100vw;height:100vh}</style>${svg}`,
    );
    await page.screenshot({
      path: new URL(
        `../public/icon-${size}.png`,
        import.meta.url,
      ).pathname.replace(/^\/(.:)/, "$1"),
      omitBackground: true,
    });
  }
} finally {
  await browser.close();
}
