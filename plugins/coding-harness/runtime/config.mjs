import { isAbsolute, normalize, relative } from 'node:path';

const TOP_LEVEL = new Set(['schemaVersion', 'adapterVersion', 'project', 'protectedContracts', 'gates', 'integrations']);
const PROJECT_KEYS = new Set(['stack', 'packageManager', 'sourceRoots', 'testRoots']);
const GATE_KEYS = new Set(['id', 'command', 'args', 'cwd', 'timeoutSeconds', 'required']);
const INTEGRATION_KEYS = new Set(['workItem', 'codeReview', 'ci']);

function exactKeys(value, allowed, name, errors) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) { errors.push(`${name} must be an object`); return; }
  for (const key of Object.keys(value)) if (!allowed.has(key)) errors.push(`unknown ${name} field: ${key}`);
  for (const key of allowed) if (!(key in value)) errors.push(`${name}.${key} is required`);
}

function pathStaysInsideRoot(cwd) {
  if (typeof cwd !== 'string' || !cwd || isAbsolute(cwd)) return false;
  const normalized = normalize(cwd).replaceAll('\\', '/');
  return normalized !== '..' && !normalized.startsWith('../') && !relative('.', normalized).startsWith('../');
}

export function validateHarnessConfig(value) {
  const errors = [];
  exactKeys(value, TOP_LEVEL, 'top-level', errors);
  if (value?.schemaVersion !== '1.0') errors.push('schemaVersion must be 1.0');
  if (value?.adapterVersion !== '0.7.0') errors.push('adapterVersion must be 0.7.0');
  exactKeys(value?.project, PROJECT_KEYS, 'project', errors);
  if (!Array.isArray(value?.project?.stack) || value?.project?.stack.some((item) => typeof item !== 'string')) errors.push('project.stack must be a string array');
  if (typeof value?.project?.packageManager !== 'string') errors.push('project.packageManager must be a string');
  for (const field of ['sourceRoots', 'testRoots']) if (!Array.isArray(value?.project?.[field]) || value?.project?.[field].some((item) => typeof item !== 'string' || !pathStaysInsideRoot(item))) errors.push(`project.${field} must be project-relative paths`);
  if (!Array.isArray(value?.protectedContracts) || value.protectedContracts.length === 0 || value.protectedContracts.some((path) => typeof path !== 'string' || !pathStaysInsideRoot(path))) errors.push('protectedContracts must be a non-empty project-relative string array');
  exactKeys(value?.gates, new Set(['preCommit', 'ci']), 'gates', errors);
  for (const profile of ['preCommit', 'ci']) {
    const checks = value?.gates?.[profile];
    if (!Array.isArray(checks)) { errors.push(`gates.${profile} must be an array`); continue; }
    const ids = new Set();
    for (const check of checks) {
      exactKeys(check, GATE_KEYS, `gates.${profile}[]`, errors);
      if (!/^[a-z0-9-]+$/.test(check?.id ?? '') || ids.has(check?.id)) errors.push(`gates.${profile} has invalid or duplicate id`); else ids.add(check.id);
      if (typeof check?.command !== 'string' || !check.command.trim() || Array.isArray(check.command)) errors.push(`gates.${profile} command is invalid`);
      if (!Array.isArray(check?.args) || check.args.some((arg) => typeof arg !== 'string')) errors.push(`gates.${profile} args must be a string array`);
      if (!pathStaysInsideRoot(check?.cwd)) errors.push(`gates.${profile} cwd escapes project root`);
      if (!Number.isInteger(check?.timeoutSeconds) || check.timeoutSeconds < 1 || check.timeoutSeconds > 3600) errors.push(`gates.${profile} timeoutSeconds must be 1..3600`);
      if (typeof check?.required !== 'boolean') errors.push(`gates.${profile} required must be boolean`);
    }
  }
  exactKeys(value?.integrations, INTEGRATION_KEYS, 'integrations', errors);
  for (const key of INTEGRATION_KEYS) if (typeof value?.integrations?.[key] !== 'string') errors.push(`integrations.${key} must be a string or none`);
  return errors;
}
