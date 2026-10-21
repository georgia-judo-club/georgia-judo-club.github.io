import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const LANGS = ['ka', 'ru', 'en'];
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const preview = read('src/preview/index.html');
const styles = (s) => (s.match(/<style>/g) ?? []).length;

test('each language page is the preview with <html lang> from the path', () => {
  const want = styles(preview.slice(0, preview.indexOf('<div id="app">')));
  assert.ok(want >= 2);
  for (const l of LANGS) {
    const html = read(`dist/${l}/index.html`);
    assert.match(html, new RegExp(`<html lang="${l}"`), l);
    assert.ok(html.includes('id="app"') && html.includes('id="dlg"'), l);
    assert.equal(styles(html.slice(0, html.indexOf('<body'))), want, l);
    // only the legacy #ru-style hash redirects; deep links never do
    assert.equal(html.split('location.replace(').length - 1, 1, l);
  }
});

test('no meta refresh anywhere in dist', () => {
  const html = readdirSync(new URL('../dist/', import.meta.url), { recursive: true }).filter((f) => f.endsWith('.html'));
  assert.ok(html.length >= 4);
  for (const f of html) assert.doesNotMatch(read(`dist/${f}`), /http-equiv="?refresh/i, f);
});
