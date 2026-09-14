import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePackage } from '../scripts/validate-package.mjs';

const plugin = join(dirname(fileURLToPath(import.meta.url)), '..');
const repository = resolve(plugin, '..', '..');

test('release validator rejects legacy files and accepts the canonical package', async () => {
  const report = await validatePackage();
  assert.equal(report.ok, true, report.violations.join('\n'));
  assert.deepEqual(report.legacyFiles, []);
  assert.deepEqual(report.templateViolations, []);
});

test('every active release surface is pinned to 0.8.1', async () => {
  const pkg = JSON.parse(await readFile(join(plugin, 'package.json'), 'utf8'));
  const manifest = JSON.parse(await readFile(join(plugin, '.codebuddy-plugin', 'plugin.json'), 'utf8'));
  const marketplace = JSON.parse(await readFile(join(repository, '.codebuddy-plugin', 'marketplace.json'), 'utf8'));
  const build = await readFile(join(repository, '_build', 'package-marketplace.py'), 'utf8');
  const releaseReadme = await readFile(join(repository, 'README.md'), 'utf8');
  const pluginReadme = await readFile(join(plugin, 'README.md'), 'utf8');
  assert.equal(pkg.version, '0.8.1');
  assert.equal(manifest.version, '0.8.1');
  assert.equal(marketplace.metadata.version, '0.8.1');
  assert.equal(marketplace.plugins[0].version, '0.8.1');
  assert.match(build, /ai-market-0\.8\.1\.zip/);
  assert.match(releaseReadme, /发布版本：`0\.8\.1`/);
  assert.match(pluginReadme, /\nVersion 0\.8\.1 /);
});
