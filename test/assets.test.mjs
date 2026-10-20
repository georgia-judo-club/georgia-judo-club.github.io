import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { checkFile, LIMIT, VIDEO_LIMIT } from '../scripts/check-assets.mjs';

const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);

const seg = (marker, body) => {
  const s = Buffer.concat([Buffer.from([0xff, marker, 0, 0]), Buffer.from(body, 'latin1')]);
  s.writeUInt16BE(s.length - 2, 2);
  return s;
};
const jpeg = (...segs) => Buffer.concat([Buffer.from([0xff, 0xd8]), ...segs, Buffer.from([0xff, 0xda, 0, 2, 0xff, 0xd9])]);
const chunk = (type) => {
  const c = Buffer.alloc(12);
  c.write(type, 4, 'latin1');
  return c;
};
const png = (...types) => Buffer.concat([Buffer.from('\x89PNG\r\n\x1a\n', 'latin1'), ...types.map(chunk)]);
const box = (type, body = Buffer.alloc(0), wide = false) => {
  const head = Buffer.alloc(wide ? 16 : 8);
  head.write(type, 4, 'latin1');
  if (wide) {
    head.writeUInt32BE(1, 0);
    head.writeBigUInt64BE(BigInt(16 + body.length), 8);
  } else head.writeUInt32BE(8 + body.length, 0);
  return Buffer.concat([head, body]);
};
const tag = (s) => Buffer.from(s, 'latin1');

test('no tracked file is oversized, an original, or carries metadata', () => {
  assert.ok(tracked.length > 50);
  assert.deepEqual(tracked.flatMap((f) => checkFile(f, readFileSync(f)).map((e) => `${f}: ${e}`)), []);
});

test('assets/source/ is ignored and holds nothing tracked', () => {
  execFileSync('git', ['check-ignore', '-q', 'assets/source/x.heic']);
  assert.deepEqual(tracked.filter((f) => f.startsWith('assets/source/')), []);
});

test('JPEG: APP1 and COM are flagged, JFIF-only is clean', () => {
  assert.deepEqual(checkFile('a.jpg', jpeg(seg(0xe0, 'JFIF\0'))), []);
  assert.deepEqual(checkFile('a.jpg', jpeg(seg(0xe0, 'JFIF\0'), seg(0xee, 'Adobe'))), []);
  assert.match(checkFile('a.jpg', jpeg(seg(0xe0, 'JFIF\0'), seg(0xe1, 'Exif\0\0II*\0'))).join(), /0xe1/);
  assert.match(checkFile('a.JPEG', jpeg(seg(0xfe, 'hello'))).join(), /0xfe/);
});

test('PNG: eXIf and tEXt are flagged, plain is clean', () => {
  assert.deepEqual(checkFile('a.png', png('IHDR', 'IDAT', 'IEND')), []);
  assert.match(checkFile('a.png', png('IHDR', 'eXIf', 'IEND')).join(), /eXIf/);
  assert.match(checkFile('a.png', png('IHDR', 'tEXt', 'IEND')).join(), /tEXt/);
});

test('MP4: location/make atoms in moov are flagged, the same bytes in mdat are not', () => {
  const ftyp = box('ftyp', tag('isom'));
  assert.match(checkFile('a.mp4', Buffer.concat([ftyp, box('moov', box('udta', box('\xa9xyz')))])).join(), /xyz/);
  assert.match(checkFile('a.mp4', Buffer.concat([ftyp, box('moov', tag('com.apple.quicktime.location'))])).join(), /location/);
  assert.deepEqual(checkFile('a.mp4', Buffer.concat([ftyp, box('mdat', tag('\xa9xyz com.apple.quicktime.location')), box('moov')])), []);
  // 64-bit size on mdat must still reach the moov behind it
  assert.match(checkFile('a.mp4', Buffer.concat([ftyp, box('mdat', tag('xxxx'), true), box('moov', tag('\xa9mak'))])).join(), /mak/);
});

test('size budgets: images 2 MiB, video 4 MiB', () => {
  assert.equal(LIMIT, 2 * 1024 * 1024);
  assert.equal(VIDEO_LIMIT, 4 * 1024 * 1024);
  assert.match(checkFile('a.jpg', Buffer.alloc(LIMIT + 1)).join(), /over limit/);
  assert.deepEqual(checkFile('a.mp4', Buffer.alloc(VIDEO_LIMIT)), []);
  assert.match(checkFile('a.mp4', Buffer.alloc(VIDEO_LIMIT + 1)).join(), /over limit/);
});

test('originals are rejected by extension', () => {
  for (const n of ['a.heic', 'b.HEIF', 'c.dng', 'd.mov', 'e.zip']) assert.match(checkFile(n, Buffer.alloc(1)).join(), /original/);
});

test('public/photos names carry the first 8 hex of their sha256', () => {
  const b = jpeg(seg(0xe0, 'JFIF\0'));
  const h = createHash('sha256').update(b).digest('hex').slice(0, 8);
  assert.deepEqual(checkFile(`public/photos/club/mat-${h}.jpg`, b), []);
  assert.match(checkFile('public/photos/club/mat-00000000.jpg', b).join(), /hash/);
  assert.match(checkFile('public/photos/mat.jpg', b).join(), /hash/);
});
