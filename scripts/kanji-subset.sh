#!/usr/bin/env bash
# Rebuilds src/fonts/noto-serif-jp-judo-600.woff2 (柔道 and the code of conduct kanji).
# Needs fonttools==4.66.1 brotli==1.2.0; set PY to that interpreter.
set -euo pipefail

PY=${PY:-python3}
TEXT=柔道勇気礼儀友情誠実名誉謙虚尊敬自制行動規範場心一二三四五六七八
out=$(cd "$(dirname "$0")/.." && pwd)/src/fonts/noto-serif-jp-judo-600.woff2
base=https://cdn.jsdelivr.net/npm/@fontsource/noto-serif-jp@5.3.0/files
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
cd "$tmp"

# fontsource chunks that hold the characters in TEXT
for n in 73 77 78 85 86 90 93 94 95 96 98 101 102 107 110 111 113 114 115 116 117; do
    curl -sSfLO "$base/noto-serif-jp-$n-600-normal.woff2"
done
shasum -a 256 -c - <<'SUMS'
1baaff8d476afc26989f2358443257c50278d5afe99a4e39ad0a7bb9c450b6bb  noto-serif-jp-101-600-normal.woff2
4c1ec673b8c6aff5b4e30df25bf5c778802c8c1c12b174bac1cdd4381b720410  noto-serif-jp-102-600-normal.woff2
ddd4bc4f0250df59c2186e603bb2595e89c51b6a3db020684de72524830c20b6  noto-serif-jp-107-600-normal.woff2
f33d2440cedd11755aa6d437e85cda4820544f5010b8acd4804e396c129ae4b0  noto-serif-jp-110-600-normal.woff2
6ebb28b473ac19c93e3c4eb09b8fbd2edb02607471aba1b666257c17c2f908b9  noto-serif-jp-111-600-normal.woff2
748805755e2665635f5d2395d84cae6b6e8e9bfe89e0093e209f0abff02556e5  noto-serif-jp-113-600-normal.woff2
de38e609b38941a933cc0d4d82a6c4ae869875a6d13e6a0fe6afb9bd5ce9a051  noto-serif-jp-114-600-normal.woff2
a8f68cf5affefeff8ef68deabed211123140bd96b3e0bbfefbc0f9e8384e9a63  noto-serif-jp-115-600-normal.woff2
fbcb520ff2a3fa424df5a5b46d9868000adf49b48e3794aba97f7e45e2772658  noto-serif-jp-116-600-normal.woff2
34436d3197ccd445803a475e6eb7d8dac3f8e22e01c48091e6acf6a870fac5ad  noto-serif-jp-117-600-normal.woff2
ab8f1badc0d4234c76f60f8f959ecc5f095439e0fd8e2d2e21a16cf6a3a01793  noto-serif-jp-73-600-normal.woff2
6a21c5537f3be02ebdd8e9926a559456a18bd4f230ba6f551ac1c541fced54a5  noto-serif-jp-77-600-normal.woff2
d8bf41b7373de85d17527e310764321dac284cec1a2f0899063873c2369e8346  noto-serif-jp-78-600-normal.woff2
e1ba8870cc31fbc6719780cb3f24ece479a6305052f0e8a7b1f597937be1afd0  noto-serif-jp-85-600-normal.woff2
db1f939ab18b4984f7d4e3aecc18b9a6622c5443ea463e13d07c62a25508f4c5  noto-serif-jp-86-600-normal.woff2
a9e51c9684ebb3239593eb8b8efc096b520f85527077bd68c7f8a67f1b99f4cb  noto-serif-jp-90-600-normal.woff2
0e5f8b0f9664427183a1db095ef9456f75befda0214e53342b29a55aa1e2a48c  noto-serif-jp-93-600-normal.woff2
90d456cd996d1e020c0f3f5009787f69efc0978214d0bfe02264f81619081ae1  noto-serif-jp-94-600-normal.woff2
c85f9aa38c19fb1ef66f625c4f88d7c33df455ac762b5fe741460259dda7330f  noto-serif-jp-95-600-normal.woff2
368e5a10d3f315e4e02a23e76cf64cd991b70eb45ea17252597cfecfb38684e8  noto-serif-jp-96-600-normal.woff2
20bbda63376e40c6aa731a4ec41bcf96d1c23f94717cfb3e91cec848bf35a37e  noto-serif-jp-98-600-normal.woff2
SUMS

"$PY" -m fontTools.merge noto-serif-jp-*-600-normal.woff2 --output-file=merged.ttf
"$PY" -m fontTools.subset merged.ttf --text="$TEXT" --flavor=woff2 --layout-features='*' --output-file="$out"
