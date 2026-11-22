// Print the slide decks (pitch/slajdy/*.html, 1280×720 px per slide) to PDF with Playwright Chromium.
// Usage (repo root):  node pitch/slajdy/build_pdf.mjs
// Needs Playwright with Chromium (npx playwright install chromium). Set PLAYWRIGHT_MODULE / CHROMIUM_PATH if not default.
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const decks = [
  ['prezentacja.html', '../prezentacja.pdf'],
];

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
for (const [src, out] of decks) {
  await page.goto(pathToFileURL(path.join(here, src)).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: path.join(here, out), width: '1280px', height: '720px', printBackground: true, preferCSSPageSize: true });
  console.log('PDF:', path.join(here, out));
}
await browser.close();
