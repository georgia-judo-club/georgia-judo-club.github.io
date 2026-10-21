// Regenerates src/styles/fonts.css; rerun after bumping a @fontsource-variable package.
import { readFileSync, writeFileSync } from 'node:fs';

// weights the preview asked Google for; fontsource's 100 900 range renders 1-2 px differently
const FAMS = [
  ['montserrat', 'Montserrat', '600 900'],
  ['inter', 'Inter', '400 700'],
  ['noto-sans-georgian', 'Noto Sans Georgian', '400 900'],
];

let out = '';
for (const [slug, name, w] of FAMS) {
  out += readFileSync(`node_modules/@fontsource-variable/${slug}/wght.css`, 'utf8')
    .replace(/font-family: '[^']+'/g, `font-family: '${name}'`)
    .replace(/font-weight: 100 900/g, `font-weight: ${w}`)
    .replace(/url\(\.\/files\//g, `url(@fontsource-variable/${slug}/files/`);
}
out += `@font-face {
  font-family: 'Noto Serif JP';
  font-style: normal;
  font-display: swap;
  font-weight: 600;
  src: url(../fonts/noto-serif-jp-judo-600.woff2) format('woff2');
  unicode-range: U+67D4,U+9053;
}
`;
writeFileSync('src/styles/fonts.css', out);
