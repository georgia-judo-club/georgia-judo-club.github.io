// One-off: node scripts/og.mjs after npm run build; rerun when the hero changes.
// Writes the 1200x630 hero of each language page to public/og/<lang>.jpg.
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { serve } from './serve.mjs';

// Chromium embeds an ICC profile (APP2); the asset gate allows only APP0/APP14
function stripApp(b) {
  const out = [b.subarray(0, 2)];
  let i = 2;
  while (b[i + 1] !== 0xda) {
    const end = i + 2 + b.readUInt16BE(i + 2);
    if (!(b[i + 1] >= 0xe1 && b[i + 1] <= 0xef && b[i + 1] !== 0xee)) out.push(b.subarray(i, end));
    i = end;
  }
  return Buffer.concat([...out, b.subarray(i)]);
}

const s = await serve('dist');
const browser = await chromium.launch();
mkdirSync('public/og', { recursive: true });
for (const lang of ['ka', 'ru', 'en']) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.clock.setFixedTime('2026-10-21T10:00:00+04:00');
  await page.goto(`${s.url}${lang}/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  writeFileSync(`public/og/${lang}.jpg`, stripApp(await page.screenshot({ type: 'jpeg', quality: 80 })));
  await ctx.close();
}
await browser.close();
await s.close();
