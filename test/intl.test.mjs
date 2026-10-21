import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LOCALE, fmtDate, fmtTime, fmtNumber } from '../src/lib/intl.mjs';

test('LOCALE maps site codes to BCP 47 tags', () => {
  assert.deepEqual(LOCALE, { ka: 'ka-GE', ru: 'ru-RU', en: 'en-GB' });
});

test('fmtDate matches the preview format in all three languages', () => {
  assert.equal(fmtDate('2026-10-17', 'ka'), '17 ოქტომბერი, 2026');
  assert.equal(fmtDate('2026-10-17', 'ru'), '17 октября 2026 г.');
  assert.equal(fmtDate('2026-10-17', 'en'), '17 October 2026');
});

test('fmtTime is 24 h in Tbilisi, whatever the host zone', () => {
  const d = new Date('2026-10-21T21:30:00Z');
  for (const lang of ['ka', 'ru', 'en']) assert.equal(fmtTime(d, lang), '01:30', lang);
});

test('fmtNumber formats GEL per locale', () => {
  const gel = { style: 'currency', currency: 'GEL' };
  assert.match(fmtNumber(1234.5, 'ka', gel), /^1\s?234,50\s₾$/);
  assert.match(fmtNumber(1234.5, 'en', gel), /^GEL\s1,234\.50$/);
});

test('every preview date is formatted at build time per language', () => {
  const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  const preview = read('src/preview/index.html');
  assert.ok(!preview.includes('const MON'), 'hand-typed month names are back');
  const iso = [...new Set([...preview.matchAll(/"(\d{4}-\d{2}-\d{2})"/g)].map((m) => m[1]))];
  assert.ok(iso.length >= 10);
  for (const lang of ['ka', 'ru', 'en']) {
    const m = read(`dist/${lang}/index.html`).match(/const DATES=(\{.*?\});/);
    assert.ok(m, `${lang}: DATES missing`);
    const dates = JSON.parse(m[1]);
    for (const d of iso) assert.equal(dates[d], fmtDate(d, lang), `${lang} ${d}`);
  }
});
