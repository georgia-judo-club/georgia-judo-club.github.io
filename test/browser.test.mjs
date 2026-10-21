import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { serve } from '../scripts/serve.mjs';

const LANGS = ['ka', 'ru', 'en'];
let srv, browser;

before(async () => {
  srv = await serve('dist');
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  await srv?.close();
});

async function open(path, viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(srv.url + path.replace(/^\//, ''));
  return { ctx, page };
}

const stored = (page) => page.evaluate(() => localStorage.getItem('gj-lang'));
const currentRoute = (page) => page.evaluate(() => document.querySelector('.nav a[aria-current="page"]')?.getAttribute('href'));

test('switcher keeps the route and remembers an explicit choice', async () => {
  const { ctx, page } = await open('/ka/#programs');
  await page.click('.langs a[hreflang="ru"]');
  await page.waitForURL(/\/ru\/#programs$/);
  assert.equal(await page.evaluate(() => document.documentElement.lang), 'ru');
  assert.equal(await currentRoute(page), '#programs');
  assert.equal(await stored(page), 'ru');
  await page.goto(srv.url);
  await page.waitForURL(/\/ru\/$/);
  await ctx.close();
});

test('just viewing a language page stores nothing', async () => {
  const { ctx, page } = await open('/en/');
  assert.equal(await stored(page), null);
  await ctx.close();
});

// LANG-05 as amended by the owner: Latin codes visible, native names as the accessible name
test('switcher shows KA RU EN in order with native accessible names and no flags', async () => {
  for (const l of LANGS) {
    const { ctx, page } = await open(`/${l}/`);
    const items = await page.$$eval('.langs a', (as) =>
      as.map((a) => [a.textContent, a.getAttribute('aria-label'), a.title, a.lang, a.hasAttribute('aria-current')]));
    assert.deepEqual(items.map((i) => i[0]), ['KA', 'RU', 'EN'], l);
    for (const i of items) assert.ok(i[1] === i[2], l);
    assert.deepEqual(items.map((i) => i[1]), ['ქართული', 'Русский', 'English'], l);
    assert.deepEqual(items.map((i) => i[3]), LANGS, l);
    assert.deepEqual(items.map((i) => i[4]), LANGS.map((x) => x === l), l);
    assert.doesNotMatch(await page.$eval('.langs', (e) => e.innerHTML), /[\u{1F1E6}-\u{1F1FF}]/u, l);
    await ctx.close();
  }
});

test('legacy language hash replaces to that language; route hashes stay', async () => {
  let { ctx, page } = await open('/ka/#ru');
  await page.waitForURL(/\/ru\/$/);
  await ctx.close();
  ({ ctx, page } = await open('/ru/#programs'));
  await page.waitForTimeout(300);
  assert.match(page.url(), /\/ru\/#programs$/);
  await ctx.close();
});

test('no horizontal overflow on small phones', async () => {
  for (const viewport of [{ width: 360, height: 780 }, { width: 390, height: 844 }]) {
    for (const l of LANGS) {
      const { ctx, page } = await open(`/${l}/`, viewport);
      await page.evaluate(() => document.fonts.ready);
      const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
      assert.ok(sw <= iw, `${l} ${viewport.width}: scrollWidth ${sw} > ${iw}`);
      await ctx.close();
    }
  }
});

// the family that renders most glyphs of a leaf element (Pitfall 11: wrappers report nothing)
async function renderedFont(page, selector) {
  await page.evaluate(() => document.fonts.ready);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument');
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector });
  const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
  return fonts.sort((a, b) => b.glyphCount - a.glyphCount)[0]?.familyName;
}

test('rendered fonts are the self-hosted families', async () => {
  let { ctx, page } = await open('/ka/');
  assert.equal(await renderedFont(page, '.lead'), 'Noto Sans Georgian');
  assert.match(await renderedFont(page, '.kanji'), /^Noto Serif JP/);
  await ctx.close();
  ({ ctx, page } = await open('/ru/'));
  assert.equal(await renderedFont(page, '.lead'), 'Inter');
  await ctx.close();
});
