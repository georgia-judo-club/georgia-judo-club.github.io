import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const dist = 'dist';
const pub = 'public';
if (!existsSync(join(dist, 'index.html'))) throw new Error('dist/index.html missing: run `npm run build` first');

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile())
    .map((e) => relative(dir, join(e.parentPath, e.name)));

const html = readFileSync(join(dist, 'index.html'), 'utf8');
const uniq = (re) => [...new Set([...html.matchAll(re)].map((m) => m[1]))];

test('dist ships every public file byte-identical', () => {
  const files = walk(pub);
  for (const f of ['index.html', 'img/logo.png', 'media/loop2_pullups_L.mp4']) assert.ok(files.includes(f), f);
  for (const f of files) assert.ok(readFileSync(join(pub, f)).equals(readFileSync(join(dist, f))), `${f} differs or is missing in dist`);
});

test('served from the root with robots.txt and noindex kept', () => {
  assert.ok(existsSync(join(dist, 'robots.txt')));
  assert.ok(html.includes('<meta name="robots" content="noindex">'));
  for (const f of walk(dist).filter((f) => f.endsWith('.html'))) {
    assert.doesNotMatch(readFileSync(join(dist, f), 'utf8'), /(?<!\/)\/georgia-judo-club\.github\.io\//, f);
  }
});

test('every asset the preview references exists in dist', () => {
  // the body is rendered from JS strings, so lychee can't see these refs
  const stills = uniq(/["']([\w-]{11}_\d{3}p\d_[PL])["']/g);
  const literals = uniq(/["'`]([^"'`\s$]+\.(?:jpg|png|mp4))["'`]/g).filter((s) => !/^https?:/.test(s));
  const posts = literals.filter((s) => !s.includes('/'));
  const loops = uniq(/loop\("([^"]+)"/g);
  assert.ok(stills.length >= 30, `only ${stills.length} still ids`);
  assert.ok(posts.length >= 28, `only ${posts.length} post names`);
  assert.ok(loops.length >= 1, 'no media loops found');

  const refs = [
    'img/logo.png',
    ...stills.map((id) => `img/st/${id}.jpg`),
    ...literals.map((s) => (s.includes('/') ? s : `img/posts/${s}`)),
    ...loops.flatMap((n) => [`media/${n}.jpg`, `media/${n}.mp4`]),
  ];
  assert.deepEqual(refs.filter((r) => !existsSync(join(dist, r))), []);
});
