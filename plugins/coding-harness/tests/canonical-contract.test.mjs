import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CANONICAL_PROJECT_FILES,
  FORBIDDEN_LEGACY_PATHS,
  RULE_FILES,
  WORKFLOW_ARTIFACTS
} from '../runtime/contract.mjs';

test('canonical project contract has one document system and all workflow artifacts', () => {
  assert.deepEqual(WORKFLOW_ARTIFACTS, [
    'README.md',
    'source-materials.md',
    'candidate-review.md',
    'requirement.md',
    'design-alignment.md',
    'design-decision.md',
    'development-contract.md',
    'task-package.md',
    'development-summary.md',
    'knowledge-update-review.md',
    'merge-report.md'
  ]);
  assert.deepEqual(RULE_FILES, [
    'architecture.md', 'engineering.md', 'testing.md', 'api-and-data.md', 'commit-and-mr.md'
  ]);
  assert.ok(CANONICAL_PROJECT_FILES.includes('docs/knowledge/项目总览.md'));
  assert.ok(CANONICAL_PROJECT_FILES.includes('docs/function/module.json'));
  assert.ok(CANONICAL_PROJECT_FILES.includes('.codebuddy/onboarding-checklist.json'));
  assert.deepEqual(FORBIDDEN_LEGACY_PATHS, [
    'docs/project/', 'knowledge/', 'requirements/', 'experience-candidates.md',
    '.codebuddy/rules/project.md', '.codebuddy/rules/management.md', '.codebuddy/rules/workflow.md',
    '.codebuddy/knowledge-descriptions.json'
  ]);
});

test('operation-to-Rules assembly never relies on optional recollection', async () => {
  const { rulesForOperation } = await import('../runtime/contract.mjs');
  assert.deepEqual(rulesForOperation('api_data_or_persistence'), ['architecture.md', 'api-and-data.md']);
  assert.throws(() => rulesForOperation('unclassified'), /unknown operation/);
});
