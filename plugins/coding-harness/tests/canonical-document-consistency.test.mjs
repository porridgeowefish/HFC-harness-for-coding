import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = join(dirname(fileURLToPath(import.meta.url)), '..');
const repository = resolve(plugin, '..', '..');

async function collect(root) {
  const files = [];
  async function visit(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const target = join(path, entry.name);
      if (entry.isDirectory()) await visit(target); else files.push(target);
    }
  }
  await visit(root); return files;
}

test('current design documents use one generated layout and distinguish the HTML simulation', async () => {
  const technical = await readFile(join(repository, '技术设计-流程模块与交接协议.md'), 'utf8');
  const adr = await readFile(join(repository, 'ADR-latest.md'), 'utf8');
  const html = await readFile(join(repository, 'AI-dev-harness.html'), 'utf8');
  for (const token of ['onboarding-checklist.json', 'knowledge-update-review.md', '.gitignore']) {
    assert.match(technical, new RegExp(token.replaceAll('.', '\\.')));
    assert.match(adr, new RegExp(token.replaceAll('.', '\\.')));
    assert.match(html, new RegExp(token.replaceAll('.', '\\.')));
  }
  assert.doesNotMatch(adr, /\.codebuddy\/checklist\.json|\.githooks\/pre-commit|node \.codebuddy\/scripts\/harness\.mjs|└── constraints\/|"constraints"\s*:/);
  assert.match(html, /10 份 workflow 文件（8 个展示页签）/);
  assert.match(html, /Workflow 非模板模拟/);
  assert.match(html, /workflows\/<\/b>[\s\S]*README\.md/);
});

test('the active plugin contract contains no content digest mechanism', async () => {
  const roots = ['runtime', 'schemas', 'templates'].map((name) => join(plugin, name));
  for (const root of roots) for (const path of await collect(root)) {
    const text = await readFile(path, 'utf8');
    assert.doesNotMatch(text, /contentDigest|artifactDigest|sha256|createHash/, path);
  }
});
