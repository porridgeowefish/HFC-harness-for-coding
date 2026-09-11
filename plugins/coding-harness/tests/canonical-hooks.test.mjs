import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { CHECKLIST_IDS, CHECKLIST_LABELS } from '../runtime/contract.mjs';

const plugin = join(dirname(fileURLToPath(import.meta.url)), '..');
const hook = join(plugin, 'hooks', 'pre-tool-use.mjs');

async function invoke(input, root = plugin) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [hook], { cwd: root, env: { ...process.env, CODEBUDDY_PROJECT_DIR: root }, shell: false });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve(JSON.parse(stdout)) : reject(new Error(stderr)));
    child.stdin.end(JSON.stringify(input));
  });
}

async function managedRoot(t) {
  const root = await mkdtemp(join(tmpdir(), 'harness-hook-managed-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, '.codebuddy'), { recursive: true });
  await writeFile(join(root, '.codebuddy', 'harness.json'), `${JSON.stringify({
    schemaVersion: '1.0', adapterVersion: '0.8.0',
    project: { stack: [], packageManager: 'none', sourceRoots: [], testRoots: [] },
    protectedContracts: ['CODEBUDDY.md'], gates: { preCommit: [], ci: [] },
    integrations: { workItem: 'none', codeReview: 'none', ci: 'none' }
  })}\n`);
  await writeFile(join(root, '.codebuddy', 'onboarding-checklist.json'), `${JSON.stringify({ schemaVersion: '1.0', items: CHECKLIST_IDS.map((id) => ({ id, label: CHECKLIST_LABELS[id], status: 'pending', actor: null, confirmedAt: null })) })}\n`);
  return root;
}

test('hook package uses CodeBuddy matcher groups', async () => {
  const value = JSON.parse(await readFile(join(plugin, 'hooks', 'hooks.json'), 'utf8'));
  assert.ok(Array.isArray(value.hooks.SessionStart[0].hooks));
  assert.equal(value.hooks.PreToolUse[0].matcher, 'Write|Edit|write_to_file|replace_in_file|Bash|execute_command');
  assert.ok(Array.isArray(value.hooks.PreToolUse[0].hooks));
});

test('PreToolUse protects state and shared contracts without blocking the runtime ignore rule', async (t) => {
  const root = await managedRoot(t);
  const state = await invoke({ hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: '.codebuddy/workflows/wf-20260908-abc123/state.json', content: '{}' } }, root);
  assert.equal(state.continue, false);
  assert.equal(state.hookSpecificOutput.permissionDecision, 'deny');

  const allowed = await invoke({ hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: '.gitignore', new_string: '.codebuddy/workflows/\n' } }, root);
  assert.equal(allowed.continue, true);

  const denied = await invoke({ hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: '.gitignore', new_string: '.codebuddy/\n' } }, root);
  assert.equal(denied.continue, false);

  for (const command of [
    'echo hacked > .codebuddy/workflows/wf-20260908-abc123/state.json',
    'Set-Content .codebuddy\\workflows\\wf-20260908-abc123\\state.json hacked',
    'Remove-Item .codebuddy/workflows/wf-20260908-abc123/state.json',
    'cat .codebuddy/workflows/wf-20260908-abc123/state.json && echo hacked > .codebuddy/workflows/wf-20260908-abc123/state.json',
    'Set-Content "$STATE" hacked',
    'Remove-Item "$STATE"',
    'cp /tmp/x "$STATE"',
    'mv /tmp/x "$STATE"',
    'tee "$STATE"',
    'dd of="$STATE"',
    'python -c "open(os.environ[\'STATE\'], \'w\').write(\'x\')"',
    'node -e "require(\'fs\').writeFileSync(process.env.STATE, \'x\')"'
  ]) {
    const result = await invoke({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command } }, root);
    assert.equal(result.hookSpecificOutput.permissionDecision, 'deny', command);
  }
  const readOnly = await invoke({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'cat .codebuddy/workflows/wf-20260908-abc123/state.json' } }, root);
  assert.equal(readOnly.continue, true);
});

test('PreToolUse runs the configured preCommit gate for git commit', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'harness-hook-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, '.codebuddy'), { recursive: true });
  const check = { id: 'forced-failure', command: process.execPath, args: ['-e', 'process.exit(2)'], cwd: '.', timeoutSeconds: 10, required: true };
  await writeFile(join(root, '.codebuddy', 'harness.json'), `${JSON.stringify({
    schemaVersion: '1.0', adapterVersion: '0.8.0',
    project: { stack: [], packageManager: 'none', sourceRoots: [], testRoots: [] },
    protectedContracts: ['CODEBUDDY.md'], gates: { preCommit: [check], ci: [] },
    integrations: { workItem: 'none', codeReview: 'none', ci: 'none' }
  })}\n`);
  await writeFile(join(root, '.codebuddy', 'onboarding-checklist.json'), `${JSON.stringify({ schemaVersion: '1.0', items: CHECKLIST_IDS.map((id) => ({ id, label: CHECKLIST_LABELS[id], status: 'pending', actor: null, confirmedAt: null })) })}\n`);
  const result = await invoke({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git commit -m test' } }, root);
  assert.equal(result.continue, false);
  assert.match(result.reason, /preCommit gate failed/);
});

test('unmanaged projects receive no-op hooks and never run a Harness gate', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'harness-hook-unmanaged-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const result = await invoke({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git commit -m test' } }, root);
  assert.equal(result.continue, true);
  const sessionHook = join(plugin, 'hooks', 'session-start.mjs');
  const session = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [sessionHook], { cwd: root, env: { ...process.env, CODEBUDDY_PROJECT_ROOT: root }, shell: false });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; }); child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject); child.on('close', (code) => code === 0 ? resolve(JSON.parse(stdout)) : reject(new Error(stderr)));
  });
  assert.equal(session.continue, true);
  assert.equal(session.hookSpecificOutput.additionalContext, '');
});
