import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

const dist = new URL('../dist/', import.meta.url);
const read = (p) => readFileSync(new URL(p, dist), 'utf8');
const SITE = 'https://georgia-judo-club.github.io/';
const LANGS = ['ka', 'ru', 'en'];
const CITY = { ka: 'თბილისი', ru: 'Тбилиси', en: 'Tbilisi' };
const OG = { ka: 'ka_GE', ru: 'ru_RU', en: 'en_GB' };
const html = readdirSync(dist, { recursive: true }).filter((f) => f.endsWith('.html'));
const metas = (h, k) => [...h.matchAll(new RegExp(`<meta (?:property|name)="${k}" content="([^"]*)"`, 'g'))].map((m) => m[1]);
const meta = (h, k) => {
  const all = metas(h, k);
  assert.equal(all.length, 1, k);
  return all[0];
};

test('sitemap lists the three language homes with alternates', () => {
  const xml = read('sitemap.xml');
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<urlset /);
  const urls = xml.match(/<url>.*?<\/url>/g);
  assert.deepEqual(urls.map((u) => u.match(/<loc>([^<]+)<\/loc>/)[1]), LANGS.map((l) => `${SITE}${l}/`));
  for (const u of urls) {
    const alts = [...u.matchAll(/<xhtml:link rel="alternate" hreflang="([a-z-]+)" href="([^"]+)"\/>/g)].map((m) => [m[1], m[2]]);
    assert.deepEqual(alts, [...LANGS.map((l) => [l, `${SITE}${l}/`]), ['x-default', SITE]], u);
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

test('every page is noindex, links the icons and uses no "ge" code', () => {
  assert.ok(html.length >= 5);
  const BAD = /\b(?:lang|hreflang|xml:lang)=["']ge(?:[-_][a-z]+)?["']|"inLanguage"\s*:\s*"ge\b|og:locale[^>]*content=["']ge_/i;
  for (const icon of ['favicon.ico', 'favicon-32.png', 'apple-touch-icon.png']) assert.ok(existsSync(new URL(icon, dist)), icon);
  for (const f of html) {
    const h = read(f);
    assert.ok(h.includes('<meta name="robots" content="noindex">'), f);
    for (const icon of ['/favicon.ico', '/favicon-32.png', '/apple-touch-icon.png']) assert.ok(h.includes(`href="${icon}"`), `${f} ${icon}`);
    assert.doesNotMatch(h, BAD, f);
  }
});
