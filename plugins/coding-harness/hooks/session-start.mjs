import { access, readdir, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join, resolve } from 'node:path';
import { detectHarnessScope } from '../runtime/project-scope.mjs';

const root = resolve(process.env.CODEBUDDY_PROJECT_ROOT ?? process.cwd());
async function exists(path) { try { await access(path, constants.F_OK); return true; } catch { return false; } }

const scope = await detectHarnessScope(root);
if (scope === 'absent') {
  console.log(JSON.stringify({ continue: true, hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: '' } }));
  process.exit(0);
}
if (scope === 'broken') {
  console.log(JSON.stringify({ continue: false, hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: 'Harness 接入不完整：请先修复 .codebuddy/harness.json 与 onboarding checklist。' } }));
  process.exit(0);
}

const workflowRoot = join(root, '.codebuddy', 'workflows');
const unfinished = [];
if (await exists(workflowRoot)) {
  for (const entry of await readdir(workflowRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    try {
      const state = JSON.parse(await readFile(join(workflowRoot, entry.name, 'state.json'), 'utf8'));
      if (state.status !== 'completed') unfinished.push({ task_id: state.task_id, stage: state.stage, next_action: state.next_action });
    } catch { unfinished.push({ task_id: entry.name, stage: 'invalid', next_action: 'repair_state' }); }
  }
}
const status = { onboarding: await exists(join(root, '.codebuddy', 'onboarding-checklist.json')) ? 'present' : 'missing', unfinished };
console.log(JSON.stringify({
  continue: true,
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: `AI Coding Harness status: ${JSON.stringify(status)}`
  }
}));
