import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WORKFLOW_ARTIFACTS } from '../runtime/contract.mjs';
import { lintTemplateText, missingTemplateContract } from '../runtime/template-lint.mjs';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

test('template linter rejects few-shot defaults but permits canonical field placeholders', () => {
  assert.deepEqual(lintTemplateText('负责人：{{OWNER}}\n任务 R-01\n命令：npm test\n证据：logs/a.txt'), [
    'mustache_placeholder', 'fixed_identifier', 'fixed_command', 'fixed_evidence_location'
  ]);
  assert.deepEqual(lintTemplateText('任务 ID：<workflow-id>\n证据：EV-<runtime-generated-id>：<what-the-evidence-proves>'), []);
  assert.deepEqual(lintTemplateText('状态：passed'), ['fixed_status_conclusion']);
});

test('template linter rejects every forbidden few-shot fact class from the design', () => {
  const cases = [
    ['任务标题：任务负责人筛选', 'fixed_task_title'],
    ['修改 `src/task-list.ts`', 'fixed_source_path'],
    ['go test ./...', 'fixed_command'],
    ['断言数量：3', 'fixed_assertion_count'],
    ['发布到 GitLab', 'fixed_platform_name'],
    ['结论：无阻断', 'fixed_status_conclusion'],
    ['TestOwnerFilter', 'fixed_test_name'],
    ['证据：reports/unit.xml', 'fixed_evidence_location']
  ];
  for (const [text, expected] of cases) assert.ok(lintTemplateText(text).includes(expected), `${text} must be rejected as ${expected}`);
});

test('every workflow template has the exact technical-design field contract and no few-shot facts', async () => {
  for (const artifact of WORKFLOW_ARTIFACTS) {
    const text = await readFile(join(packageRoot, 'templates', 'workflow', artifact), 'utf8');
    assert.deepEqual(missingTemplateContract(text, artifact), [], `${artifact} field contract`);
    assert.deepEqual(lintTemplateText(text), [], `${artifact} must have no few-shot fact`);
  }
});

test('every development contract block template uses only declared placeholders', async () => {
  for (const artifact of ['http-api.md', 'public-interface.md', 'data.md', 'cross-task-integration.md', 'shared-behavior.md']) {
    const text = await readFile(join(packageRoot, 'templates', 'contracts', artifact), 'utf8');
    assert.deepEqual(lintTemplateText(text), [], `${artifact} must have no few-shot fact`);
  }
});
