import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FORBIDDEN_LEGACY_PATHS, RULE_FILES, WORKFLOW_ARTIFACTS } from '../runtime/contract.mjs';
import { lintTemplateText, missingTemplateContract } from '../runtime/template-lint.mjs';
import { validateTemplateContract } from '../runtime/markdown-contract.mjs';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RELEASE_VERSION = '0.9.0';

async function walk(root) {
  const paths = []; const directories = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const target = join(directory, entry.name);
      if (entry.isDirectory()) { directories.push(normalized(relative(root, target)) + '/'); await visit(target); }
      else paths.push(target);
    }
  }
  await visit(root);
  return { paths, directories };
}

export const PACKAGE_DIRECTORIES = Object.freeze([
  '.codebuddy-plugin/', 'agents/', 'bin/', 'commands/', 'hooks/', 'runtime/', 'schemas/', 'scripts/', 'skills/',
  'skills/harness/', 'skills/harness/references/',
  'templates/', 'templates/business/', 'templates/contracts/', 'templates/decisions/', 'templates/engineering/', 'templates/shared/', 'templates/project/', 'templates/project/.codebuddy/', 'templates/project/.codebuddy/rules/',
  'templates/project/docs/', 'templates/project/docs/function/', 'templates/project/docs/knowledge/', 'templates/project/docs/knowledge/architecture/',
  'templates/project/docs/workflows/', 'templates/workflow/', 'tests/'
]);

function normalized(path) { return path.replaceAll('\\', '/'); }
function isLegacy(path) {
  if (path.startsWith('templates/project/')) path = path.slice('templates/project/'.length);
  return FORBIDDEN_LEGACY_PATHS.some((legacy) => {
    const token = normalized(legacy);
    if (token.endsWith('/')) return path.startsWith(token);
    return path.endsWith(token) || path.includes(`/${token}`);
  });
}

export async function validatePackage(root = packageRoot) {
  const { paths: files, directories } = await walk(root);
  const relativeFiles = files.map((path) => normalized(relative(root, path)));
  const legacyFiles = [...relativeFiles, ...directories].filter(isLegacy);
  const directoryViolations = [
    ...directories.filter((path) => !PACKAGE_DIRECTORIES.includes(path)).map((path) => `unexpected directory: ${path}`),
    ...PACKAGE_DIRECTORIES.filter((path) => !directories.includes(path)).map((path) => `missing directory: ${path}`)
  ];
  const templateViolations = [];
  for (const path of files.filter((path) => {
    const relativePath = normalized(relative(root, path));
    // The template index documents destinations; it is never loaded as generated content.
    return (relativePath.startsWith('templates/') && relativePath !== 'templates/README.md') || relativePath.startsWith('skills/');
  })) {
    const relativePath = normalized(relative(root, path));
    const text = await readFile(path, 'utf8');
    const violations = lintTemplateText(text);
    const contractViolations = validateTemplateContract(relativePath, text);
    if (violations.length) templateViolations.push(`${relativePath}: diagnostic blacklist: ${violations.join(', ')}`);
    if (contractViolations.length) templateViolations.push(`${relativePath}: Markdown contract: ${contractViolations.join(', ')}`);
  }
  const workflowTemplates = relativeFiles.filter((path) => path.startsWith('templates/workflow/')).map((path) => path.slice('templates/workflow/'.length)).sort();
  const artifactMismatch = JSON.stringify(workflowTemplates) !== JSON.stringify([...WORKFLOW_ARTIFACTS].sort());
  const templateRules = relativeFiles.filter((path) => path.startsWith('templates/project/.codebuddy/rules/')).map((path) => path.slice('templates/project/.codebuddy/rules/'.length)).sort();
  const templateRulesMismatch = JSON.stringify(templateRules) !== JSON.stringify([...RULE_FILES].sort());
  const templateRuleViolations = [];
  for (const rule of RULE_FILES) {
    const content = await readFile(join(root, 'templates', 'project', '.codebuddy', 'rules', rule), 'utf8');
    if (!/^\uFEFF?适用场景:\s*.+(?:\r?\n|$)/.test(content)) templateRuleViolations.push(`template Rule must start with 适用场景:: ${rule}`);
  }
  const contractViolations = [];
  for (const artifact of WORKFLOW_ARTIFACTS) {
    const missing = missingTemplateContract(await readFile(join(root, 'templates', 'workflow', artifact), 'utf8'), artifact);
    if (missing.length) contractViolations.push(`templates/workflow/${artifact}: missing required fields: ${missing.join(', ')}`);
  }
  const manifest = JSON.parse(await readFile(join(root, '.codebuddy-plugin', 'plugin.json'), 'utf8'));
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  const manifestViolations = [];
  if (manifest.version !== RELEASE_VERSION || pkg.version !== RELEASE_VERSION) manifestViolations.push(`release version must be ${RELEASE_VERSION}`);
  if (manifest.version !== pkg.version) manifestViolations.push(`plugin manifest version ${manifest.version} does not match package.json version ${pkg.version}`);
  if (manifest.agents !== './agents') manifestViolations.push('plugin manifest agents path is not "./agents"');
  if (manifest.hooks !== './hooks/hooks.json') manifestViolations.push('plugin manifest hooks path is not "./hooks/hooks.json"');
  const hookConfig = JSON.parse(await readFile(join(root, 'hooks', 'hooks.json'), 'utf8'));
  const session = hookConfig.hooks?.SessionStart;
  const preTool = hookConfig.hooks?.PreToolUse;
  const expectedMatchers = ['^(Write|Edit|write_to_file|replace_in_file)$', '^(Bash|execute_command)$'];
  const hookViolation = !Array.isArray(session) || !Array.isArray(session[0]?.hooks) || session[0].hooks[0]?.type !== 'command' ||
    !Array.isArray(preTool) || JSON.stringify(preTool.map((entry) => entry.matcher)) !== JSON.stringify(expectedMatchers) ||
    preTool.some((entry) => !Array.isArray(entry.hooks) || entry.hooks[0]?.type !== 'command')
    ? ['hooks.json does not use the canonical CodeBuddy matcher/hooks structure'] : [];
  const violations = [...directoryViolations, ...legacyFiles.map((path) => `legacy path: ${path}`), ...templateViolations, ...contractViolations, ...templateRuleViolations, ...(artifactMismatch ? ['workflow template set differs from canonical artifact set'] : []), ...(templateRulesMismatch ? ['template Rule set differs from canonical Rules'] : []), ...manifestViolations, ...hookViolation];
  return { ok: violations.length === 0, violations, directories: directories.sort(), directoryViolations, legacyFiles, templateViolations };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await validatePackage();
  if (!report.ok) { console.error(report.violations.join('\n')); process.exitCode = 1; }
  else console.log(`Canonical Coding Harness package is valid: ${packageRoot}`);
}
