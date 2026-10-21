import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const dist = new URL('../dist/', import.meta.url);
const astro = readdirSync(new URL('_astro/', dist));
const files = readdirSync(dist, { recursive: true }).filter((f) => /\.(html|css|js)$/.test(f));
const subset = (href) => href.match(/-([a-z]+(?:-ext)?)-wght-normal\.[\w-]+\.woff2$/)?.[1];

test('georgian, cyrillic and latin subsets are self-hosted', () => {
  for (const s of ['georgian', 'cyrillic', 'latin']) {
    assert.ok(astro.some((f) => f.endsWith('.woff2') && subset(`/${f}`) === s), s);
  }
});

test('nothing loads from Google Fonts', () => {
  for (const f of files) assert.doesNotMatch(readFileSync(new URL(f, dist), 'utf8'), /googleapis|gstatic/, f);
});

test('the Georgian face covers Mtavruli', () => {
  const css = astro.filter((f) => f.endsWith('.css')).map((f) => readFileSync(new URL(`_astro/${f}`, dist), 'utf8')).join('');
  const face = css.split('@font-face').find((b) => b.includes('noto-sans-georgian-georgian-wght'));
  assert.ok(face, 'georgian @font-face missing');
  assert.match(face, /unicode-range:[^;}]*U\+1C90-1CBA/i);
});

test('each page preloads only its script subset plus latin', () => {
  const allowed = { ka: ['georgian', 'latin'], ru: ['cyrillic', 'latin'], en: ['latin'] };
  for (const [l, ok] of Object.entries(allowed)) {
    const h = readFileSync(new URL(`${l}/index.html`, dist), 'utf8');
    const pre = [...h.matchAll(/<link rel="preload" href="([^"]+)" as="font"/g)].map((m) => subset(m[1]));
    assert.ok(pre.length > 0, l);
    assert.deepEqual([...new Set(pre)].sort(), [...ok].sort(), l);
  }
});
