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
  unicode-range: U+4E00,U+4E03,U+4E09,U+4E8C,U+4E94,U+5100,U+516B,U+516D,U+5236,U+52C7,U+52D5,U+53CB,U+540D,U+56DB,U+5834,U+5B9F,U+5C0A,U+5FC3,U+60C5,U+656C,U+67D4,U+6C17,U+793C,U+7BC4,U+81EA,U+865A,U+884C,U+898F,U+8A89,U+8AA0,U+8B19,U+9053;
}
`;
writeFileSync('src/styles/fonts.css', out);
