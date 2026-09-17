import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KNOWLEDGE_ROOT_DIRECTORIES } from '../runtime/contract.mjs';

const plugin = join(dirname(fileURLToPath(import.meta.url)), '..');

test('shared-development knowledge roots and decision fallback are canonical', async () => {
  assert.deepEqual(KNOWLEDGE_ROOT_DIRECTORIES, ['architecture', 'api', 'data', 'integration', 'decisions', 'modules']);
  const design = await readFile(join(plugin, '..', '..', 'design', '技术设计-流程模块与交接协议.md'), 'utf8');
  assert.match(design, /docs\/knowledge\/decisions\//);
  assert.match(design, /Markdown 不取代可执行权威来源/);
});
