import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const wf = (name) => readFileSync(new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8');
const files = ['build.yml', 'deploy.yml', 'pr.yml'];

// Top-level permissions block as sorted "key: value" lines.
function permissions(text) {
  const m = text.match(/^permissions:\n((?: {2}\S.*\n)+)/m);
  assert.ok(m, 'top-level permissions block missing');
  return m[1].trim().split('\n').map((l) => l.trim()).sort();
}

test('deploy.yml deploys only from main, least privilege, after build', () => {
  const t = wf('deploy.yml');
  assert.match(t, /^ {2}push:\n {4}branches: \[main\]$/m);
  assert.match(t, /^ {2}workflow_dispatch:/m);
  assert.deepEqual(permissions(t), ['contents: read', 'id-token: write', 'pages: write']);
  assert.match(t, /^ {4}uses: \.\/\.github\/workflows\/build\.yml$/m);
  assert.match(t, /^ {4}needs: build$/m);
  assert.match(t, /environment:\n {6}name: github-pages/);
  assert.match(t, /uses: actions\/deploy-pages@/);
});

test('pr.yml builds on pull_request and has no deploy path', () => {
  const t = wf('pr.yml');
  assert.match(t, /^ {2}pull_request:/m);
  assert.deepEqual(permissions(t), ['contents: read']);
  assert.match(t, /uses: \.\/\.github\/workflows\/build\.yml/);
  for (const bad of ['deploy-pages', 'pages: write', 'id-token', 'environment:', 'push:']) {
    assert.ok(!t.includes(bad), `pr.yml must not contain ${bad}`);
  }
});

test('build.yml runs gitleaks, build + tests and lychee', () => {
  const t = wf('build.yml');
  assert.match(t, /^ {2}workflow_call:/m);
  assert.match(t, /fetch-depth: 0/);
  assert.match(t, /sha256sum -c/);
  assert.match(t, /gitleaks git /);
  assert.match(t, /build-cmd: npm run build && npm test$/m);
  assert.match(t, /uses: lycheeverse\/lychee-action@/);
  assert.match(t, /--offline/);
  assert.match(t, /--root-dir \$\{\{ github\.workspace \}\}\/dist/);
});

test('build.yml installs Chromium before the build runs the browser tests', () => {
  const t = wf('build.yml');
  const i = t.indexOf('run: npx --yes playwright@1.64.0 install --with-deps chromium');
  assert.ok(i > 0, 'playwright install step missing');
  assert.ok(i < t.indexOf('uses: withastro/action@'), 'install must come before withastro/action');
});

test('every third-party action is pinned to a full SHA with a version comment', () => {
  for (const f of files) {
    const uses = wf(f).match(/uses: \S+.*$/gm) ?? [];
    for (const u of uses.filter((x) => !x.startsWith('uses: ./'))) {
      assert.match(u, /^uses: [\w.-]+\/[\w.-]+@[0-9a-f]{40} {2}# v\d/, `${f}: ${u}`);
    }
  }
});
