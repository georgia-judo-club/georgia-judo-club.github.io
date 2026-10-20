import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

export const LIMIT = 2 * 1024 * 1024;
export const VIDEO_LIMIT = 4 * 1024 * 1024;
const VIDEO = /\.(mp4|m4v|webm)$/i;
const ORIGINAL = /\.(heic|heif|dng|mov|zip)$/i;
const PNG_BAD = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME']);
const MOOV_BAD = ['\xa9xyz', 'loci', 'com.apple.quicktime.location', '\xa9mak', '\xa9mod', 'com.apple.quicktime.make', 'com.apple.quicktime.model'].map((s) => Buffer.from(s, 'latin1'));

// allowlist: only APP0 (JFIF) and APP14 (Adobe) may precede the image data
function jpegIssue(b) {
  for (let o = 2; o + 4 <= b.length && b[o] === 0xff; o += 2 + b.readUInt16BE(o + 2)) {
    const m = b[o + 1];
    if (m === 0xda || m === 0xd9) return null;
    if ((m >= 0xe1 && m <= 0xed) || m === 0xef || m === 0xfe) return `JPEG segment 0x${m.toString(16)}`;
  }
  return null;
}

function pngIssue(b) {
  for (let o = 8; o + 8 <= b.length; o += 12 + b.readUInt32BE(o)) {
    const t = b.toString('latin1', o + 4, o + 8);
    if (PNG_BAD.has(t)) return `PNG chunk ${t}`;
  }
  return null;
}

// only moov is searched, so random bytes in mdat can't false-positive
function mp4Issue(b) {
  for (let o = 0; o + 8 <= b.length; ) {
    let size = b.readUInt32BE(o);
    const type = b.toString('latin1', o + 4, o + 8);
    if (size === 1 && o + 16 <= b.length) size = Number(b.readBigUInt64BE(o + 8));
    else if (size === 0) size = b.length - o;
    if (size < 8) return 'MP4 box parse error';
    if (type === 'moov') {
      const moov = b.subarray(o, o + size);
      const hit = MOOV_BAD.find((k) => moov.includes(k));
      return hit ? `MP4 metadata ${hit.toString('latin1')}` : null;
    }
    o += size;
  }
  return null;
}

// public/photos names must be <slug>-<sha256[:8]>.jpg so a replaced photo gets a new URL
function photoNameIssue(name, b) {
  if (!name.startsWith('public/photos/')) return null;
  const h = /-([0-9a-f]{8})\.jpg$/.exec(name)?.[1];
  return h === createHash('sha256').update(b).digest('hex').slice(0, 8) ? null : 'photo name hash does not match content, run npm run images';
}

export function checkFile(name, b) {
  const errs = [];
  if (ORIGINAL.test(name)) errs.push('original/unsupported format, run npm run images');
  if (b.length > (VIDEO.test(name) ? VIDEO_LIMIT : LIMIT)) errs.push(`${b.length} bytes over limit`);
  const meta = /\.jpe?g$/i.test(name) ? jpegIssue(b) : /\.png$/i.test(name) ? pngIssue(b) : /\.(mp4|m4v)$/i.test(name) ? mp4Issue(b) : null;
  if (meta) errs.push(meta);
  const photo = photoNameIssue(name, b);
  if (photo) errs.push(photo);
  return errs;
}

// pre-commit: check the staged blobs, which is what actually gets committed
if (process.argv[2] === '--staged') {
  const names = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  const bad = names.flatMap((n) => checkFile(n, execFileSync('git', ['cat-file', 'blob', `:${n}`], { maxBuffer: 1 << 30 })).map((e) => `${n}: ${e}`));
  if (bad.length) {
    console.error(bad.join('\n'));
    process.exit(1);
  }
}
