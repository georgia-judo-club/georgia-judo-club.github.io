#!/usr/bin/env bash
# Rebuilds src/fonts/noto-serif-jp-judo-600.woff2 (柔道 only).
# Needs fonttools==4.66.1 brotli==1.2.0; set PY to that interpreter.
set -euo pipefail

PY=${PY:-python3}
out=$(cd "$(dirname "$0")/.." && pwd)/src/fonts/noto-serif-jp-judo-600.woff2
base=https://cdn.jsdelivr.net/npm/@fontsource/noto-serif-jp@5.3.0/files
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
cd "$tmp"

# chunk 94 holds U+67D4, chunk 114 holds U+9053
for n in 94 114; do
    curl -sSfLO "$base/noto-serif-jp-$n-600-normal.woff2"
done
shasum -a 256 -c - <<'EOF'
90d456cd996d1e020c0f3f5009787f69efc0978214d0bfe02264f81619081ae1  noto-serif-jp-94-600-normal.woff2
de38e609b38941a933cc0d4d82a6c4ae869875a6d13e6a0fe6afb9bd5ce9a051  noto-serif-jp-114-600-normal.woff2
EOF

"$PY" -m fontTools.merge noto-serif-jp-94-600-normal.woff2 noto-serif-jp-114-600-normal.woff2 --output-file=merged.ttf
"$PY" -m fontTools.subset merged.ttf --text=柔道 --flavor=woff2 --layout-features='*' --output-file="$out"
