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
      if (state.status !== 'completed') unfinished.push({
        taskId: String(state.task_id ?? entry.name),
        stage: String(state.stage ?? 'invalid'),
        nextAction: String(state.next_action ?? 'repair_state'),
        updatedAt: Number.isFinite(Date.parse(state.updated_at)) ? Date.parse(state.updated_at) : 0
      });
    } catch { unfinished.push({ taskId: entry.name, stage: 'invalid', nextAction: 'repair_state', updatedAt: 0 }); }
  }
}
unfinished.sort((a, b) => b.updatedAt - a.updatedAt || a.taskId.localeCompare(b.taskId));
const recent = unfinished[0];
const clip = (value, length = 160) => String(value ?? '').replace(/[\r\n]/g, ' ').slice(0, length);
const additionalContext = recent
  ? `AI Coding Harness：未完成 workflow：${unfinished.length}。当前只恢复最近任务：id=${clip(recent.taskId)}；stage=${clip(recent.stage)}；next_action=${clip(recent.nextAction)}。${unfinished.length > 1 ? `另有 ${unfinished.length - 1} 个未完成任务，按需使用 status 查询，不自动注入。` : ''}`
  : 'AI Coding Harness：未完成 workflow：0。';
console.log(JSON.stringify({
  continue: true,
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: additionalContext.slice(0, 1024)
  }
}));
