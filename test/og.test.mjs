import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkFile } from '../scripts/check-assets.mjs';

// width x height from the first SOF0/SOF2 marker
function jpegSize(b) {
  for (let i = 2; i + 9 < b.length; ) {
    assert.equal(b[i], 0xff, 'bad marker');
    const m = b[i + 1], len = b.readUInt16BE(i + 2);
    if (m === 0xc0 || m === 0xc2) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + len;
  }
  assert.fail('no SOF marker');
}

for (const l of ['ka', 'ru', 'en']) {
  test(`${l} share image is 1200x630, small, clean and in the head`, () => {
    const f = `public/og/${l}.jpg`;
    const b = readFileSync(f);
    assert.ok(b.length < 600 * 1024, `${b.length} bytes`);
    assert.ok(b[0] === 0xff && b[1] === 0xd8, 'not a JPEG');
    assert.deepEqual(jpegSize(b), [1200, 630]);
    assert.deepEqual(checkFile(f, b), []);
    const html = readFileSync(`dist/${l}/index.html`, 'utf8');
    assert.match(html, new RegExp(`<meta property="og:image" content="[^"]*/og/${l}\\.jpg">`));
  });
}
