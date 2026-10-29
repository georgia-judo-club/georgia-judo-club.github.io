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
  const { ctx, page } = await open('/ka/programs/');
  await page.click('.langs a[hreflang="ru"]');
  await page.waitForURL(/\/ru\/programs\/$/);
  assert.equal(await page.evaluate(() => document.documentElement.lang), 'ru');
  assert.equal(await currentRoute(page), '/ru/programs/');
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

test('legacy hashes move to real paths: language to its home, route to its page', async () => {
  let { ctx, page } = await open('/ka/#ru');
  await page.waitForURL(/\/ru\/$/);
  await ctx.close();
  ({ ctx, page } = await open('/ru/#trampoline'));
  assert.match(page.url(), /\/ru\/trampoline\/$/);
  assert.equal(await page.textContent('main h1'), 'Батут');
  await ctx.close();
  // the root picker keeps the hash, so old shared links land on the real path too
  ({ ctx, page } = await open('/#story-jubilee-2025'));
  await page.waitForURL(/\/en\/story-jubilee-2025\/$/);
  await ctx.close();
});

test('in-app links push real paths without reloading; back and forward work', async () => {
  const { ctx, page } = await open('/en/');
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.evaluate(() => { window.same = 1; });
  await page.click('.ftr nav a[href="/en/coaches/"]');
  await page.waitForURL(/\/en\/coaches\/$/);
  assert.equal(await page.textContent('main h1'), 'Coaches');
  assert.equal(await page.title(), 'Coaches · Judo Club “Georgia”');
  await page.click('.ftr nav a[href="/en/boxing/"]');
  await page.waitForURL(/\/en\/boxing\/$/);
  await page.goBack();
  await page.waitForURL(/\/en\/coaches\/$/);
  assert.equal(await page.textContent('main h1'), 'Coaches');
  await page.goBack();
  await page.waitForURL(/\/en\/$/);
  assert.ok(await page.$('#h1'));
  assert.equal(await page.title(), 'Judo Club “Georgia” · Tbilisi');
  await page.goForward();
  await page.waitForURL(/\/en\/coaches\/$/);
  assert.equal(await page.evaluate(() => window.same), 1, 'navigation reloaded the page');
  assert.deepEqual(errors, []);
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

// owner 2026-10-29: unconfirmed content stays hidden until the club confirms it
test('no draft badge or [placeholder] on any route or coach card', async () => {
  for (const l of LANGS) {
    const { ctx, page } = await open(`/${l}/`);
    for (const r of await page.evaluate(() => ROUTES)) {
      await page.goto(`${srv.url}${l}/${r === 'home' ? '' : `${r}/`}`);
      const [badges, text] = await page.evaluate(() => {
        let t = document.body.innerText;
        document.querySelectorAll('[data-coach]').forEach((b) => { b.click(); t += dlg.innerText; });
        return [document.querySelectorAll('.badge').length, t];
      });
      assert.equal(badges, 0, `${l} ${r}`);
      assert.doesNotMatch(text, /\[[^\]]{3,}\]/, `${l} ${r}`);
    }
    await ctx.close();
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

test('legal pages render in every language and are linked from the footer', async () => {
  for (const l of LANGS) {
    const { ctx, page } = await open(`/${l}/`);
    const links = await page.$$eval('.ftr .lgn a', (as) => as.map((a) => a.getAttribute('href')));
    assert.deepEqual(links, ['privacy', 'cookies', 'children'].map((r) => `/${l}/${r}/`), l);
    for (const r of links) {
      await page.click(`.ftr .lgn a[href="${r}"]`);
      await page.waitForFunction((k) => document.querySelector('.lgl h2')?.textContent === LGL[lang][k].s[0][0], r.split('/')[2]);
      assert.equal(new URL(page.url()).pathname, r);
      const [h1, n, upd] = await page.evaluate(() =>
        [document.querySelector('main h1').textContent, document.querySelectorAll('.lgl h2').length, document.querySelector('.lgl time')?.dateTime]);
      assert.ok(h1.trim() && n >= 3, `${l} ${r}`);
      assert.equal(upd, '2026-10-29', `${l} ${r}`);
    }
    await ctx.close();
  }
});

// GA requests are stubbed; the test ID is spliced into the served page, the build itself stays ID-less
async function openGa(path, gaId) {
  const { ctx, page } = await open('/');
  const gtm = [];
  await ctx.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.includes('googletagmanager.com')) { gtm.push(url); return route.fulfill({ contentType: 'text/javascript', body: '' }); }
    if (!gaId || route.request().resourceType() !== 'document') return route.continue();
    const res = await route.fetch();
    return route.fulfill({ response: res, body: (await res.text()).replace('const GA_ID="";', `const GA_ID="${gaId}";`) });
  });
  await page.goto(srv.url + path.replace(/^\//, ''));
  // keep chat/phone links from leaving the page; in-app route links still route
  await page.evaluate(() => addEventListener('click', (e) => { if (!e.target.closest('a[href^="/"]')) e.preventDefault(); }));
  return { ctx, page, gtm };
}
const layer = (page) => page.evaluate(() => (window.dataLayer ?? []).map((a) => Array.from(a)));

test('without a GA_ID there is no banner and nothing goes to Google', async () => {
  const { ctx, page, gtm } = await openGa('/en/boxing/');
  await page.click('.bx-h .act [data-join]');
  await page.click('#dlg .chan.wa');
  assert.equal(await page.$('#ck'), null);
  assert.equal(await page.$('[data-ck-open]'), null);
  assert.deepEqual(gtm, []);
  await ctx.close();
});

test('with a GA_ID gtag waits for Accept, then tracks views and join clicks', async () => {
  let { ctx, page, gtm } = await openGa('/ru/', 'G-TEST1');
  assert.ok(await page.isVisible('#ck'));
  const cls = await page.$$eval('#ck button', (bs) => bs.map((b) => b.className));
  assert.equal(cls.length, 2);
  assert.equal(cls[0], cls[1], 'Accept and Decline look the same');
  await page.click('[data-ck="denied"]');
  assert.deepEqual(gtm, []);
  assert.equal(await page.evaluate(() => localStorage.getItem('gj-consent')), 'denied');
  await ctx.close();

  ({ ctx, page, gtm } = await openGa('/ru/trampoline/', 'G-TEST1'));
  assert.deepEqual(gtm, []);
  assert.deepEqual((await layer(page))[0], ['consent', 'default',
    { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' }]);
  await page.click('[data-ck="granted"]');
  await page.waitForFunction(() => document.getElementById('gtag'));
  assert.ok(await page.isHidden('#ck'));
  assert.match(gtm[0], /gtag\/js\?id=G-TEST1/);
  await page.click('.bx-h .act [data-join]');
  await page.click('#dlg .chan.wa');
  await page.keyboard.press('Escape');
  await page.click('.ftr .lgn a[href="/ru/privacy/"]');
  await page.waitForSelector('.lgl');
  const dl = await layer(page);
  assert.deepEqual(dl.find((a) => a[1] === 'update'), ['consent', 'update', { analytics_storage: 'granted' }]);
  assert.deepEqual(dl.filter((a) => a[1] === 'page_view').map((a) => a[2].page_path), ['/ru/trampoline/', '/ru/privacy/']);
  assert.deepEqual(dl.find((a) => a[1] === 'join_click')[2], { channel: 'whatsapp', sport: 'trampoline', lang: 'ru' });
  await ctx.close();
});
