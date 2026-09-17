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

test('every active release surface is pinned to 0.9.1 and distributed by Git Marketplace', async () => {
  const pkg = JSON.parse(await readFile(join(plugin, 'package.json'), 'utf8'));
  const manifest = JSON.parse(await readFile(join(plugin, '.codebuddy-plugin', 'plugin.json'), 'utf8'));
  const marketplace = JSON.parse(await readFile(join(repository, '.codebuddy-plugin', 'marketplace.json'), 'utf8'));
  const releaseReadme = await readFile(join(repository, 'README.md'), 'utf8');
  const pluginReadme = await readFile(join(plugin, 'README.md'), 'utf8');
  assert.equal(pkg.version, '0.9.1');
  assert.equal(manifest.version, '0.9.1');
  assert.equal(marketplace.version, '0.9.1');
  assert.equal(Object.hasOwn(marketplace, 'metadata'), false);
  assert.equal(marketplace.plugins[0].version, '0.9.1');
  assert.match(releaseReadme, /发布版本：`0\.9\.1`/);
  assert.match(releaseReadme, /plugin marketplace add/);
  assert.match(releaseReadme, /plugin marketplace update/);
  assert.doesNotMatch(releaseReadme, /从 ZIP 安装|ai-market-0\.9\.0\.zip/);
  assert.match(pluginReadme, /\nVersion 0\.9\.1 /);
});
