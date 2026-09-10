import { execFile } from 'node:child_process';
import { access, readFile, readdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { CANONICAL_PROJECT_FILES, FORBIDDEN_LEGACY_PATHS, KNOWLEDGE_ROOT_DIRECTORIES, KNOWLEDGE_ROOT_FILES, RULE_FILES, WORKFLOW_ARTIFACTS } from './contract.mjs';
import { validateHarnessConfig } from './config.mjs';
import { validateChecklist } from './onboarding.mjs';
import { validateCompletedDocument, validateStructureContract } from './markdown-contract.mjs';

async function exists(path) { try { await access(path, constants.F_OK); return true; } catch { return false; } }
const execFileAsync = promisify(execFile);

async function git(root, args) {
  try {
    const result = await execFileAsync('git', ['-C', root, '-c', 'core.quotepath=false', ...args], { windowsHide: true, encoding: 'utf8' });
    return { code: 0, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
  } catch (error) {
    return { code: Number.isInteger(error.code) ? error.code : -1, stdout: String(error.stdout ?? '').trim(), stderr: String(error.stderr ?? error.message).trim() };
  }
}

async function sharedContractFiles(root) {
  const files = [
    'CODEBUDDY.md', '.gitignore', '.codebuddy/settings.json', '.codebuddy/harness.json',
    '.codebuddy/onboarding-checklist.json'
  ];
  async function visit(relativeRoot) {
    const directory = join(root, ...relativeRoot.split('/'));
    if (!(await exists(directory))) return;
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const next = `${relativeRoot}/${entry.name}`;
      if (entry.isDirectory()) await visit(next);
      else if (entry.isFile()) files.push(next);
    }
  }
  await visit('docs');
  await visit('.codebuddy/rules');
  await visit('.codebuddy/agents');
  return [...new Set(files)].sort();
}

async function knowledgeStructureCheck(root) {
  const directory = join(root, 'docs', 'knowledge');
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const unexpected = entries
      .filter((entry) => entry.isFile() ? !KNOWLEDGE_ROOT_FILES.includes(entry.name) : entry.isDirectory() ? !KNOWLEDGE_ROOT_DIRECTORIES.includes(entry.name) : true)
      .map((entry) => entry.name)
      .sort();
    return { id: 'knowledge-root-allowlist', ok: unexpected.length === 0, unexpected };
  } catch (error) {
    return { id: 'knowledge-root-allowlist', ok: false, errors: [error.message] };
  }
}

async function gitContractChecks(root, checklistComplete) {
  const repository = await git(root, ['rev-parse', '--show-toplevel']);
  if (repository.code !== 0) return [{
    id: 'git-repository', ok: false, severity: checklistComplete ? 'error' : 'warning',
    errors: ['project is not connected to a Git repository; initialize or clone Git before sharing the confirmed contract']
  }];

  const files = await sharedContractFiles(root);
  const ignoredResult = await git(root, ['check-ignore', '--no-index', '--', ...files]);
  const ignoreCheckFailed = ![0, 1].includes(ignoredResult.code);
  const ignored = ignoredResult.code === 0 ? ignoredResult.stdout.split(/\r?\n/).filter(Boolean).map((path) => path.replaceAll('\\', '/')).sort() : [];
  const trackedResult = await git(root, ['ls-files', '--cached', '--', ...files]);
  const tracked = new Set(trackedResult.stdout.split(/\r?\n/).filter(Boolean).map((path) => path.replaceAll('\\', '/')));
  const untracked = files.filter((path) => !tracked.has(path));
  return [
    { id: 'git-contract-not-ignored', ok: !ignoreCheckFailed && ignored.length === 0, severity: 'error', ignored, errors: ignoreCheckFailed ? [`unable to evaluate Git ignore rules: ${ignoredResult.stderr}`] : [] },
    {
      id: 'git-contract-tracked', ok: untracked.length === 0,
      severity: checklistComplete ? 'error' : 'warning', untracked,
      errors: untracked.length ? [checklistComplete ? 'confirmed shared contract must be tracked by Git' : 'shared contract is not tracked yet; stage it after the checklist is confirmed'] : []
    }
  ];
}

async function visibleEntries(root) {
  const entries = [];
  async function walk(directory) {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      if (['.git', 'node_modules'].includes(entry.name)) continue;
      const absolute = join(directory, entry.name);
      const relative = absolute.slice(root.length + 1).replaceAll('\\', '/');
      if (relative === '.codebuddy/workflows' || relative.startsWith('.codebuddy/workflows/')) continue;
      if (entry.isSymbolicLink()) entries.push(relative);
      else if (entry.isDirectory()) { entries.push(`${relative}/`); await walk(absolute); }
      else if (entry.isFile()) entries.push(relative);
    }
  }
  await walk(root);
  return entries;
}

async function markdownContractChecks(root) {
  const checks = [];
  const entries = await visibleEntries(root);
  const expectedPaths = new Set(entries.map((path) => path.replace(/\/$/, '')));
  const treePath = join(root, 'docs', 'knowledge', '文件树.md');
  try {
    const text = await readFile(treePath, 'utf8');
    const errors = validateCompletedDocument('docs/knowledge/文件树.md', text, { expectedPaths: new Set(entries) });
    checks.push({ id: 'markdown:file-tree-contract', ok: errors.length === 0, errors });
  } catch (error) { checks.push({ id: 'markdown:file-tree-contract', ok: false, errors: [error.message] }); }
  const fixed = ['CODEBUDDY.md', 'docs/workflows/README.md', 'docs/knowledge/项目总览.md', 'docs/knowledge/业务入口.md'];
  for (const path of fixed) {
    try { const errors = validateCompletedDocument(path, await readFile(join(root, ...path.split('/')), 'utf8'), { expectedPaths }); checks.push({ id: `markdown:${path}`, ok: errors.length === 0, errors }); }
    catch (error) { checks.push({ id: `markdown:${path}`, ok: false, errors: [error.message] }); }
  }
  async function visit(relativeDirectory, matcher) {
    const directory = join(root, ...relativeDirectory.split('/'));
    if (!await exists(directory)) return;
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (!entry.isFile() || !matcher(entry.name)) continue;
      const path = `${relativeDirectory}/${entry.name}`;
      try { const errors = validateCompletedDocument(path, await readFile(join(root, ...path.split('/')), 'utf8'), { expectedPaths }); checks.push({ id: `markdown:${path}`, ok: errors.length === 0, errors }); }
      catch (error) { checks.push({ id: `markdown:${path}`, ok: false, errors: [error.message] }); }
    }
  }
  await visit('docs/knowledge/modules', (name) => name.endsWith('.md'));
  async function visitFunctions(directory, prefix = 'docs/function') {
    if (!await exists(directory)) return;
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      const relative = path.slice(root.length + 1).replaceAll('\\', '/');
      if (entry.isDirectory()) await visitFunctions(path, relative);
      else if (entry.isFile() && (entry.name === '功能描述.md' || entry.name === '功能演变历史.md')) {
        try { const errors = validateCompletedDocument(relative, await readFile(path, 'utf8'), { expectedPaths }); checks.push({ id: `markdown:${relative}`, ok: errors.length === 0, errors }); }
        catch (error) { checks.push({ id: `markdown:${relative}`, ok: false, errors: [error.message] }); }
      }
    }
  }
  await visitFunctions(join(root, 'docs', 'function'));
  const workflowsRoot = join(root, 'docs', 'workflows');
  if (await exists(workflowsRoot)) {
    for (const entry of await readdir(workflowsRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const taskRoot = join(workflowsRoot, entry.name);
      const names = (await readdir(taskRoot, { withFileTypes: true })).filter((item) => item.isFile()).map((item) => item.name).sort();
      const missing = WORKFLOW_ARTIFACTS.filter((artifact) => !names.includes(artifact));
      const unexpected = names.filter((name) => !WORKFLOW_ARTIFACTS.includes(name));
      checks.push({ id: `workflow:${entry.name}:artifact-set`, ok: missing.length === 0 && unexpected.length === 0, errors: [...missing.map((name) => `missing ${name}`), ...unexpected.map((name) => `unexpected ${name}`)] });
      for (const artifact of WORKFLOW_ARTIFACTS) {
        const path = `docs/workflows/${entry.name}/${artifact}`;
        try {
          const errors = validateStructureContract(`templates/workflow/${artifact}`, await readFile(join(root, ...path.split('/')), 'utf8'));
          checks.push({ id: `workflow:${entry.name}:${artifact}`, ok: errors.length === 0, errors });
        } catch (error) { checks.push({ id: `workflow:${entry.name}:${artifact}`, ok: false, errors: [error.message] }); }
      }
    }
  }
  const rulesRoot = join(root, '.codebuddy', 'rules');
  for (const rule of RULE_FILES) {
    try { const errors = validateCompletedDocument(`.codebuddy/rules/${rule}`, await readFile(join(rulesRoot, rule), 'utf8')); checks.push({ id: `markdown:rule:${rule}`, ok: errors.length === 0, errors }); }
    catch (error) { checks.push({ id: `markdown:rule:${rule}`, ok: false, errors: [error.message] }); }
  }
  const architecture = join(root, 'docs', 'knowledge', 'architecture');
  for (const artifact of ['component.puml', 'component.svg']) {
    const path = `docs/knowledge/architecture/${artifact}`;
    try {
      const errors = validateCompletedDocument(path, await readFile(join(root, ...path.split('/')), 'utf8'), { expectedPaths });
      checks.push({ id: `architecture:${artifact}`, ok: errors.length === 0, errors });
    } catch (error) { checks.push({ id: `architecture:${artifact}`, ok: false, errors: [error.message] }); }
  }
  // Every Markdown link in the canonical knowledge and Rules files must point
  // at a file that exists in this checkout; external URLs are left untouched.
  const linkErrors = [];
  for (const check of checks.filter((item) => item.id.startsWith('markdown:'))) {
    const path = check.id.replace(/^markdown:/, '').replace(/^rule:/, '.codebuddy/rules/');
    if (!path.endsWith('.md')) continue;
    try {
      const text = await readFile(join(root, ...path.split('/')), 'utf8');
      for (const [, target] of text.matchAll(/\]\(([^)#]+)(?:#[^)]+)?\)/g)) {
        if (/^(?:https?:|mailto:)/i.test(target)) continue;
        const base = join(root, ...path.split('/').slice(0, -1));
        const resolved = resolve(base, target);
        const normalizedRoot = root.replaceAll('\\', '/');
        const normalizedResolved = resolved.replaceAll('\\', '/');
        if (!normalizedResolved.startsWith(`${normalizedRoot}/`) && normalizedResolved !== normalizedRoot) linkErrors.push(`${path} -> ${target}`);
        else if (!await exists(resolved)) linkErrors.push(`${path} -> ${target}`);
      }
    } catch { /* the document check above carries the read error */ }
  }
  checks.push({ id: 'markdown:links', ok: linkErrors.length === 0, errors: linkErrors });
  return checks;
}

export async function doctorProject(projectRoot) {
  const root = resolve(projectRoot); const checks = [];
  const configPath = join(root, '.codebuddy', 'harness.json');
  try { const errors = validateHarnessConfig(JSON.parse(await readFile(configPath, 'utf8'))); checks.push({ id: 'harness-config', ok: errors.length === 0, errors }); }
  catch (error) { checks.push({ id: 'harness-config', ok: false, errors: [error.message] }); }
  for (const file of CANONICAL_PROJECT_FILES) checks.push({ id: `required:${file}`, ok: await exists(join(root, ...file.split('/'))) });
  checks.push(await knowledgeStructureCheck(root));
  for (const forbidden of FORBIDDEN_LEGACY_PATHS) {
    const target = forbidden.includes('/') && !forbidden.endsWith('.md') ? join(root, ...forbidden.replace(/\/$/, '').split('/')) : join(root, ...forbidden.split('/'));
    checks.push({ id: `forbidden:${forbidden}`, ok: !(await exists(target)) });
  }
  const rulesRoot = join(root, '.codebuddy', 'rules');
  try {
    const actual = await readdir(rulesRoot, { withFileTypes: true });
    checks.push({ id: 'rules-exact-set', ok: actual.length === RULE_FILES.length && actual.every((entry) => entry.isFile() && RULE_FILES.includes(entry.name)) });
    for (const rule of RULE_FILES) { const content = await readFile(join(rulesRoot, rule), 'utf8'); checks.push({ id: `rule-scope:${rule}`, ok: /^\uFEFF?适用场景:\s*.+(?:\r?\n|$)/.test(content) }); }
  } catch { checks.push({ id: 'rules-exact-set', ok: false }); }
  const checklistPath = join(root, '.codebuddy', 'onboarding-checklist.json');
  let checklistErrors = ['checklist is missing'];
  let checklist = null;
  try { checklist = JSON.parse(await readFile(checklistPath, 'utf8')); checklistErrors = validateChecklist(checklist); } catch (error) { checklistErrors = [`invalid checklist JSON: ${error.message}`]; }
  const incomplete = checklistErrors.length ? [] : checklist.items.filter((item) => item.status !== 'confirmed').map((item) => item.id);
  checks.push({ id: 'onboarding-checklist', ok: checklistErrors.length === 0 && incomplete.length === 0, errors: checklistErrors, incomplete });
  checks.push(...await gitContractChecks(root, checklistErrors.length === 0 && incomplete.length === 0));
  checks.push(...await markdownContractChecks(root));
  const nonChecklistFailures = checks.filter((check) => check.id !== 'onboarding-checklist' && !check.ok && check.severity !== 'warning');
  const nextAction = checklistErrors.length ? 'repair_onboarding_checklist' : nonChecklistFailures.length ? 'repair_canonical_contract' : incomplete.length ? 'confirm_onboarding_checklist' : 'start_workflow';
  return { ok: nonChecklistFailures.length === 0 && checklistErrors.length === 0 && incomplete.length === 0, checks, nextAction };
}
