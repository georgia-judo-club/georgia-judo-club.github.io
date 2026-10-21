import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const page = () => readFileSync(new URL('../dist/404.html', import.meta.url), 'utf8');
const LANGS = ['ka', 'ru', 'en'];

// runs the reveal script against fake globals; returns "<visible blocks>|<html lang>"
function shown(pathname, { stored = null, languages = [], storageThrows = false } = {}) {
  const js = [...page().matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((s) => s.includes('data-404'));
  assert.ok(js, '404 pick script present');
  const els = LANGS.map((l) => ({ l, hidden: false, getAttribute: () => l }));
  const doc = {};
  vm.runInNewContext(js, {
    location: { pathname, search: '', hash: '', replace: () => assert.fail('404 must not redirect') },
    localStorage: {
      getItem: () => {
        if (storageThrows) throw new Error('storage blocked');
        return stored;
      },
    },
    navigator: { languages, language: languages[0] },
    document: { querySelectorAll: () => els, documentElement: doc },
  });
  return [els.filter((e) => !e.hidden).map((e) => e.l).join(), doc.lang].join('|');
}

test('path language wins over stored', () => assert.equal(shown('/ru/nope/', { stored: 'en' }), 'ru|ru'));
test('stored beats browser', () => assert.equal(shown('/nope/', { stored: 'en', languages: ['ru'] }), 'en|en'));
test('browser language when nothing stored', () => assert.equal(shown('/nope/', { languages: ['ka-GE'] }), 'ka|ka'));
test('nothing known falls back to ka', () => assert.equal(shown('/x', { languages: ['fr'] }), 'ka|ka'));
test('blocked storage still uses browser language', () =>
  assert.equal(shown('/nope/', { storageThrows: true, languages: ['ru-RU'] }), 'ru|ru'));

test('three blocks with own lang, ui.ts copy and a home link', () => {
  const html = page();
  const copy = {
    ka: ['გვერდი ვერ მოიძებნა', 'მთავარ გვერდზე'],
    ru: ['Страница не найдена', 'На главную'],
    en: ['Page not found', 'Go to the home page'],
  };
  assert.equal(html.split('data-404="').length - 1, 3);
  for (const l of LANGS) {
    const m = html.match(new RegExp(`<section[^>]*data-404="${l}"[^>]*>[\\s\\S]*?</section>`));
    assert.ok(m, l);
    assert.ok(m[0].includes(`lang="${l}"`) && m[0].includes(`href="/${l}/"`), l);
    for (const s of copy[l]) assert.ok(m[0].includes(s), `${l}: ${s}`);
  }
});

test('404 is noindex, has the icons and never redirects', () => {
  const html = page();
  assert.ok(html.includes('<meta name="robots" content="noindex">'));
  for (const i of ['/favicon.ico', '/favicon-32.png', '/apple-touch-icon.png']) assert.ok(html.includes(`href="${i}"`), i);
  assert.ok(!html.includes('location.replace'));
  assert.doesNotMatch(html, /http-equiv="?refresh/i);
});
