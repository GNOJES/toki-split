import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const source = new URL("../assets/og-image.svg", import.meta.url);
const output = fileURLToPath(
  new URL("../assets/og-image.png", import.meta.url),
);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.goto(source.href);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: output });
  console.log(`Share image rendered: ${output}`);
} finally {
  await browser.close();
}
