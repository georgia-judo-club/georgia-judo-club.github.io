// Manual gate (needs network for the CDN scripts): node scripts/visual-parity.mjs <base-ref> [--widths=1440,390] [--langs=ka,ru,en]
// Screenshots <base-ref>'s public/ at /#<lang> and dist/ at /<lang>/, and fails on any byte difference.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { serve } from './serve.mjs';

const args = process.argv.slice(2);
const base = args.find((a) => !a.startsWith('--'));
const opt = (k, d) => (args.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? d).split(',');
if (!base) throw new Error('usage: visual-parity.mjs <base-ref> [--widths=1440,390] [--langs=ka,ru,en]');
const widths = opt('widths', '1440,390').map(Number);
const langs = opt('langs', 'ka,ru,en');

const tmp = mkdtempSync(join(tmpdir(), 'parity-'));
execFileSync('tar', ['-x', '-C', tmp], { input: execFileSync('git', ['archive', base, 'public'], { maxBuffer: 1 << 30 }) });
const [old, cur] = await Promise.all([serve(join(tmp, 'public')), serve('dist')]);
const browser = await chromium.launch();

async function shot(url, width) {
  const ctx = await browser.newContext({
    viewport: { width, height: width === 390 ? 844 : 900 },
    reducedMotion: 'reduce', deviceScaleFactor: 1, timezoneId: 'Asia/Tbilisi',
  });
  const page = await ctx.newPage();
  await page.clock.setFixedTime('2026-10-21T10:00:00+04:00');
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  const png = await page.screenshot({ fullPage: true });
  await ctx.close();
  return png;
}

let bad = 0;
for (const lang of langs) {
  for (const w of widths) {
    const a = await shot(`${old.url}#${lang}`, w);
    const b = await shot(`${cur.url}${lang}/`, w);
    if (a.equals(b)) {
      console.log(`${lang} ${w} IDENTICAL`);
    } else {
      bad++;
      const p = join(tmp, `${lang}-${w}`);
      writeFileSync(`${p}-base.png`, a);
      writeFileSync(`${p}-new.png`, b);
      console.log(`${lang} ${w} DIFFER ${p}-{base,new}.png`);
    }
  }
}
await browser.close();
await Promise.all([old.close(), cur.close()]);
process.exit(bad ? 1 : 0);
