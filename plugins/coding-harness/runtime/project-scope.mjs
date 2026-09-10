import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join, resolve } from 'node:path';
import { validateHarnessConfig } from './config.mjs';
import { validateChecklist } from './onboarding.mjs';

async function exists(path) {
  try { await access(path, constants.F_OK); return true; } catch { return false; }
}

/** Return the Hook scope without reading any Harness state for absent projects. */
export async function detectHarnessScope(projectRoot) {
  const root = resolve(projectRoot);
  const configPath = join(root, '.codebuddy', 'harness.json');
  const checklistPath = join(root, '.codebuddy', 'onboarding-checklist.json');
  if (await exists(configPath)) {
    try {
      const errors = validateHarnessConfig(JSON.parse(await readFile(configPath, 'utf8')));
      if (errors.length) return 'broken';
      if (!await exists(checklistPath)) return 'broken';
      const checklistErrors = validateChecklist(JSON.parse(await readFile(checklistPath, 'utf8')));
      return checklistErrors.length === 0 ? 'managed' : 'broken';
    } catch { return 'broken'; }
  }
  return await exists(checklistPath) ? 'broken' : 'absent';
}
