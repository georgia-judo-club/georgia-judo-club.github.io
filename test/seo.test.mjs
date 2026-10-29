import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { loadApp } from '../src/lib/app.mjs';

const dist = new URL('../dist/', import.meta.url);
const read = (p) => readFileSync(new URL(p, dist), 'utf8');
const SITE = 'https://georgia-judo-club.github.io/';
const LANGS = ['ka', 'ru', 'en'];
const CITY = { ka: 'თბილისი', ru: 'Тбилиси', en: 'Tbilisi' };
const OG = { ka: 'ka_GE', ru: 'ru_RU', en: 'en_GB' };
const html = readdirSync(dist, { recursive: true }).filter((f) => f.endsWith('.html'));
const metas = (h, k) => [...h.matchAll(new RegExp(`<meta (?:property|name)="${k}" content="([^"]*)"`, 'g'))].map((m) => m[1]);
const ROUTES = loadApp(readFileSync(new URL('../src/preview/index.html', import.meta.url), 'utf8')).routes;
// <title> text and attributes escape quotes differently
const dec = (s) => s.replace(/&#39;|&quot;|&amp;/g, (e) => ({ '&#39;': "'", '&quot;': '"', '&amp;': '&' })[e]);
const rel = (r) => (r === 'home' ? '' : `${r}/`);
const INDEXABLE = /INDEXABLE = true/.test(readFileSync(new URL('../src/config.ts', import.meta.url), 'utf8'));
const meta = (h, k) => {
  const all = metas(h, k);
  assert.equal(all.length, 1, k);
  return all[0];
};

test('sitemap lists every route in every language with alternates', () => {
  const xml = read('sitemap.xml');
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<urlset [^>]+>\n(<url>.*<\/url>\n)+<\/urlset>\n$/);
  assert.doesNotMatch(xml, /&(?!amp;|lt;|gt;|quot;|apos;)/);
  const urls = xml.match(/<url>.*?<\/url>/g);
  assert.ok(ROUTES.length >= 40, `${ROUTES.length} routes`);
  assert.deepEqual(urls.map((u) => u.match(/<loc>([^<]+)<\/loc>/)[1]), ROUTES.flatMap((r) => LANGS.map((l) => `${SITE}${l}/${rel(r)}`)));
  for (const [i, u] of urls.entries()) {
    const r = rel(ROUTES[Math.floor(i / LANGS.length)]);
    assert.ok(existsSync(new URL(`${u.match(/<loc>[^<]+\.io\/([^<]*)<\/loc>/)[1]}index.html`, dist)), u);
    const alts = [...u.matchAll(/<xhtml:link rel="alternate" hreflang="([a-z-]+)" href="([^"]+)"\/>/g)].map((m) => [m[1], m[2]]);
    assert.deepEqual(alts, [...LANGS.map((l) => [l, `${SITE}${l}/${r}`]), ['x-default', r ? `${SITE}ka/${r}` : SITE]], u);
  }
});

test('robots.txt allows all and points at the sitemap', () => {
  const t = read('robots.txt');
  assert.match(t, /^User-agent: \*$/m);
  assert.match(t, /^Allow: \/$/m);
  assert.match(t, new RegExp(`^Sitemap: ${SITE}sitemap\\.xml$`, 'm'));
});

for (const l of LANGS) {
  test(`${l} page head is complete`, () => {
    const h = read(`${l}/index.html`);
    const title = h.match(/<title>([^<]+)<\/title>/)?.[1];
    assert.ok(title?.includes(CITY[l]), `title: ${title}`);
    assert.ok(meta(h, 'og:title').includes(CITY[l]));
    assert.ok(meta(h, 'description').length > 20);
    assert.ok(h.includes(`<link rel="canonical" href="${SITE}${l}/">`));
    const alts = [...h.matchAll(/<link rel="alternate" hreflang="([a-z-]+)" href="([^"]+)">/g)].map((m) => [m[1], m[2]]);
    assert.deepEqual(alts, [...LANGS.map((x) => [x, `${SITE}${x}/`]), ['x-default', SITE]]);
    assert.equal(meta(h, 'og:type'), 'website');
    assert.ok(meta(h, 'og:site_name'));
    assert.ok(meta(h, 'og:description'));
    assert.equal(meta(h, 'og:url'), `${SITE}${l}/`);
    assert.equal(meta(h, 'og:image'), `${SITE}og/${l}.jpg`);
    assert.equal(meta(h, 'og:locale'), OG[l]);
    assert.deepEqual(metas(h, 'og:locale:alternate'), LANGS.filter((x) => x !== l).map((x) => OG[x]));
    assert.equal(meta(h, 'twitter:card'), 'summary_large_image');
  });
}

for (const l of LANGS) {
  test(`${l}: every route has its own title, canonical, hreflang and share tags`, () => {
    const titles = new Set();
    for (const r of ROUTES) {
      const h = read(`${l}/${rel(r)}index.html`), url = `${SITE}${l}/${rel(r)}`;
      const title = dec(h.match(/<title>([^<]+)<\/title>/)?.[1] ?? '');
      assert.ok(title && !titles.has(title), `${r}: ${title}`);
      titles.add(title);
      assert.equal(dec(meta(h, 'og:title')), title, r);
      assert.equal(dec(meta(h, 'twitter:title')), title, r);
      assert.ok(meta(h, 'description').length > 20, r);
      assert.equal(meta(h, 'og:description'), meta(h, 'description'), r);
      assert.deepEqual(h.match(/<link rel="canonical" href="([^"]+)">/g), [`<link rel="canonical" href="${url}">`], r);
      assert.equal(meta(h, 'og:url'), url, r);
      const alts = [...h.matchAll(/<link rel="alternate" hreflang="([a-z-]+)" href="([^"]+)">/g)].map((m) => [m[1], m[2]]);
      assert.deepEqual(alts, [...LANGS.map((x) => [x, `${SITE}${x}/${rel(r)}`]), ['x-default', r === 'home' ? SITE : `${SITE}ka/${rel(r)}`]], r);
      const img = meta(h, 'og:image');
      assert.ok(img === `${SITE}og/${l}.jpg` || (/^(judo|boxing|trampoline|gymnastics)$/.test(r) && img.startsWith(`${SITE}photos/`)), `${r}: ${img}`);
      assert.ok(existsSync(new URL(img.slice(SITE.length), dist)), img);
      assert.match(h, /<noscript>.*<a href="tel:\+995599933897">\+995 599 93 38 97<\/a>.*<a href="https:\/\/wa\.me\/995599933897">WhatsApp<\/a>.*<\/noscript>/s, r);
    }
  });

  test(`${l}: home carries SportsClub JSON-LD`, () => {
    const all = [...read(`${l}/index.html`).matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)];
    assert.equal(all.length, 1);
    const ld = JSON.parse(all[0][1]);
    assert.equal(ld['@type'], 'SportsClub');
    assert.equal(ld.url, `${SITE}${l}/`);
    assert.equal(ld.telephone, '+995 599 93 38 97');
    assert.equal(ld.foundingDate, '2008-12-25');
    assert.equal(ld.address.addressCountry, 'GE');
    assert.ok(ld.sameAs.length >= 3 && ld.sameAs.every((u) => read(`${l}/index.html`).includes(`"${u}"`)));
    assert.doesNotMatch(read(`${l}/judo/index.html`), /application\/ld\+json/);
  });
}

test('every page is noindex exactly while INDEXABLE is off, links the icons and uses no "ge" code', () => {
  assert.ok(html.length >= 5);
  const BAD = /\b(?:lang|hreflang|xml:lang)=["']ge(?:[-_][a-z]+)?["']|"inLanguage"\s*:\s*"ge\b|og:locale[^>]*content=["']ge_/i;
  for (const icon of ['favicon.ico', 'favicon-32.png', 'apple-touch-icon.png']) assert.ok(existsSync(new URL(icon, dist)), icon);
  for (const f of html) {
    const h = read(f);
    assert.equal(h.includes('<meta name="robots" content="noindex">'), !INDEXABLE, f);
    for (const icon of ['/favicon.ico', '/favicon-32.png', '/apple-touch-icon.png']) assert.ok(h.includes(`href="${icon}"`), `${f} ${icon}`);
    assert.doesNotMatch(h, BAD, f);
  }
});

test('Search Console and GA4 stay off until their IDs are set', () => {
  for (const f of html) assert.doesNotMatch(read(f), /google-site-verification|const GA_ID="[^"]/, f);
});
