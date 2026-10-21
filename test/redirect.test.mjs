import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const root = () => readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');

// runs the root picker against fake browser globals and returns the redirect target
function run({ stored = null, languages, search = '', hash = '', storageThrows = false }) {
  const scripts = [...root().matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.equal(scripts.length, 1);
  let target;
  vm.runInNewContext(scripts[0], {
    localStorage: {
      getItem: () => {
        if (storageThrows) throw new Error('storage blocked');
        return stored;
      },
    },
    navigator: { languages, language: languages?.[0] },
    location: { pathname: '/', search, hash, replace: (u) => (target = u) },
  });
  return target;
}

test('stored choice wins over browser', () => assert.equal(run({ stored: 'ru', languages: ['en-US'] }), '/ru/'));
test('first supported browser language', () => assert.equal(run({ languages: ['en-GB', 'ka'] }), '/en/'));
test('unsupported browser language falls back to ka', () => assert.equal(run({ languages: ['fr-FR'] }), '/ka/'));
test('junk stored value is ignored', () => assert.equal(run({ stored: 'xx', languages: ['ru-RU'] }), '/ru/'));
test('blocked storage still uses browser language', () =>
  assert.equal(run({ storageThrows: true, languages: ['ru-RU'] }), '/ru/'));
test('query and route hash are kept', () =>
  assert.equal(run({ languages: [], search: '?a=1', hash: '#programs' }), '/ka/?a=1#programs'));
test('legacy language hash beats storage and is dropped', () =>
  assert.equal(run({ stored: 'en', languages: ['en-US'], hash: '#ru' }), '/ru/'));

test('root works without JS via plain links', () => {
  const html = root();
  for (const l of ['ka', 'ru', 'en']) assert.ok(html.includes(`<a href="/${l}/"`), l);
});
