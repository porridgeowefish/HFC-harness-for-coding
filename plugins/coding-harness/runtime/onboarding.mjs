import { access, copyFile, mkdir, open, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CANONICAL_PROJECT_FILES, CHECKLIST_IDS, CHECKLIST_LABELS, RULE_FILES } from './contract.mjs';
import { previewFileTree, refreshFileTree } from './navigation.mjs';
import { validateCompletedDocument } from './markdown-contract.mjs';

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const templateRoot = join(pluginRoot, 'templates', 'project');
const CHECKLIST_KEYS = new Set(['id', 'label', 'status', 'actor', 'confirmedAt']);
const CHECKLIST_PROMPTS = Object.freeze({
  context_sources: '项目事实分别来自哪些文档、代码和外部系统？唯一事实位置是否已确认？',
  integration_boundaries: '所有外部系统的读取、写入和禁止写入边界是否已列清？',
  integration_access: '对接权限、刷新方式以及不可用时的降级方式是否已经确认？',
  knowledge_accuracy: '项目总览、全量文件树、业务入口、架构图和工程模块说明是否准确且完整？',
  function_currency: '识别到的业务模块与功能点是否都已建立当前功能说明和演变历史？',
  rules_assembly: '五份 Rules 是否已按本项目事实补充并确认适用范围？',
  workflow_templates: '十一份 workflow 产物、五类共同开发契约与审核模板是否已核对？',
  project_materials: '项目专属素材、配置与适配信息是否已具备且不含未决占位？'
});

// Only these static, non-fact assets may exist during the prepare phase.  All
// project-specific Markdown (overview, business/engineering knowledge, Rules
// and diagrams) is written directly from the completed subagent draft during
// finalize; copying their placeholder templates would create a misleading
// completed-looking initialization.
const PREPARE_TEMPLATE_PATHS = new Set([
  'CODEBUDDY.md',
  '.codebuddy/settings.json',
  'docs/knowledge/文件树.md',
  'docs/function/module.json',
  'docs/workflows/README.md'
]);
const PREPARED_SCAN_EXCLUSIONS = Object.freeze([
  '.codebuddy/workflows'
]);
const PREPARE_SCAFFOLD_DIRECTORIES = new Set([
  '.codebuddy', '.codebuddy/agents', '.codebuddy/rules', '.codebuddy/workflows',
  'docs', 'docs/knowledge', 'docs/knowledge/architecture', 'docs/knowledge/modules',
  'docs/function', 'docs/workflows'
]);
const AGENT_DEFINITION_FILES = Object.freeze([
  'code-reviewer.md',
  'business-knowledge-writer.md',
  'engineering-knowledge-writer.md',
  'rules-writer.md'
]);
// The prepare/finalize boundary is a session protocol.  Keep the original
// inventory in memory so a later finalize call does not mistake the scaffold
// itself for user source material.  No project-side state file is introduced.
const preparedScans = new Map();

async function exists(path) { try { await access(path, constants.F_OK); return true; } catch { return false; } }
async function writeJsonAtomic(path, value) { const temp = `${path}.${process.pid}.${Date.now()}.tmp`; await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`); await rename(temp, path); }
function validTime(value) { return typeof value === 'string' && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value; }

async function files(root) {
  const output = [];
  async function walk(directory) { for (const item of await readdir(directory, { withFileTypes: true })) { const path = join(directory, item.name); if (item.isDirectory()) await walk(path); else output.push(path); } }
  await walk(root); return output;
}

async function visibleProjectFiles(root, excluded = new Set()) {
  const output = [];
  async function walk(directory) {
    for (const item of await readdir(directory, { withFileTypes: true })) {
      if (['.git', 'node_modules'].includes(item.name)) continue;
      const path = join(directory, item.name);
      if (excluded.has(resolve(path))) continue;
      if (item.isDirectory()) await walk(path);
      else if (item.isFile()) output.push(relative(root, path).replaceAll('\\', '/'));
    }
  }
  await walk(root);
  return output.sort();
}

async function visibleProjectEntries(root, excluded = new Set()) {
  const output = [];
  async function walk(directory) {
    for (const item of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      if (['.git', 'node_modules'].includes(item.name)) continue;
      const path = join(directory, item.name);
      const relativePath = normalProjectPath(relative(root, path));
      if (isExcludedPath(relativePath, excluded)) continue;
      if (item.isSymbolicLink()) { output.push(relativePath); continue; }
      if (item.isDirectory()) { output.push(`${relativePath}/`); await walk(path); }
      else if (item.isFile()) output.push(relativePath);
    }
  }
  await walk(root);
  return output.sort();
}

async function isPrepareScaffold(root, path, scaffold = {}) {
  const target = join(root, ...path.split('/'));
  if (path === 'CODEBUDDY.md' || path === '.codebuddy/settings.json' || path.startsWith('.codebuddy/agents/') || path === 'docs/workflows/README.md') {
    const agentName = path.startsWith('.codebuddy/agents/') ? path.slice('.codebuddy/agents/'.length) : null;
    const source = agentName && AGENT_DEFINITION_FILES.includes(agentName) ? join(pluginRoot, 'agents', agentName) : join(templateRoot, ...path.split('/'));
    try { return (await readFile(target)).equals(await readFile(source)); } catch { return false; }
  }
  if (path === 'docs/knowledge/文件树.md') {
    try {
      const text = await readFile(target, 'utf8');
      return !text.includes(' — ') && text.split(/\r?\n/).filter((line) => line.trim()).every((line) => line.startsWith('# 文件树') || line.startsWith('初始化分工骨架：') || /^\s*- `[^`]+`\/?$/.test(line));
    } catch { return false; }
  }
  if (path === 'docs/function/module.json') {
    try { return JSON.stringify(JSON.parse(await readFile(target, 'utf8'))) === JSON.stringify({ schemaVersion: '1.0', modules: [] }); } catch { return false; }
  }
  if (path === '.codebuddy/harness.json' || path === '.codebuddy/onboarding-checklist.json') {
    try {
      const value = JSON.parse(await readFile(target, 'utf8'));
      if (path === '.codebuddy/onboarding-checklist.json') return validateChecklist(value).length === 0;
      return JSON.stringify(value) === JSON.stringify(scaffold[path]);
    } catch { return false; }
  }
  if (path === '.gitignore') {
    try { return (await readFile(target, 'utf8')).trim() === '.codebuddy/workflows/'; } catch { return false; }
  }
  return false;
}

async function sourceEntriesAfterPrepare(root, extraExcluded = [], scaffold = {}) {
  const excluded = new Set([...PREPARED_SCAN_EXCLUSIONS, ...extraExcluded].map((path) => normalProjectPath(path).replace(/^\/+|\/+$/g, '')));
  const entries = await visibleProjectEntries(root, excluded);
  const retainedFiles = [];
  for (const entry of entries) if (!entry.endsWith('/') && !await isPrepareScaffold(root, entry, scaffold)) retainedFiles.push(entry);
  // A scaffold can leave behind an empty parent such as `docs/` or
  // `.codebuddy/`. It is not a source entry unless a retained item remains
  // below it, while user files in those parents are preserved.
  const retainedDirectories = entries.filter((entry) => entry.endsWith('/')).filter((entry) => {
    const directory = entry.slice(0, -1);
    if (!PREPARE_SCAFFOLD_DIRECTORIES.has(directory)) return true;
    return retainedFiles.some((candidate) => candidate.startsWith(`${directory}/`));
  });
  return [...retainedFiles, ...retainedDirectories].sort();
}

function normalisedRelative(path) { return String(path).replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/$/, ''); }

function preparedPathCanBeReused(path, { allowPrepared = false, preparedBaseline = new Set(), hasPreparedContext = false } = {}) {
  // A finalize call without the prepare inventory must fail closed.  There is
  // no project-side manifest/hash by design, so an existing long-lived asset
  // cannot be distinguished from a user's pre-existing document.  Callers
  // must retain the prepare result (or pass sourceEntries) to opt into reuse.
  return allowPrepared && hasPreparedContext && !preparedBaseline.has(normalisedRelative(path));
}

async function existingKnowledgeAssets(root, draft, { allowPrepared = false, preparedBaseline = new Set(), hasPreparedContext = false } = {}) {
  const paths = [
    'docs/knowledge/项目总览.md', 'docs/knowledge/业务入口.md',
    'docs/knowledge/architecture/component.puml', 'docs/knowledge/architecture/component.svg',
    ...RULE_FILES.map((name) => `.codebuddy/rules/${name}`),
    ...draft.engineeringModules.map((module) => `docs/knowledge/modules/${module.name}.md`),
    ...draft.businessModules.flatMap((module) => [
      `docs/function/${module.module}/function.json`,
      ...module.features.flatMap((feature) => [
        `docs/function/${module.module}/${feature.name}/功能描述.md`,
        `docs/function/${module.module}/${feature.name}/功能演变历史.md`
      ])
    ])
  ];
  const conflicts = [];
  for (const path of paths) {
    if (!await exists(join(root, ...path.split('/')))) continue;
    if (path === 'docs/function/module.json') {
      try {
        const value = JSON.parse(await readFile(join(root, ...path.split('/')), 'utf8'));
        if (JSON.stringify(value) === JSON.stringify({ schemaVersion: '1.0', modules: [] })) continue;
      } catch { /* malformed user content remains a conflict */ }
    }
    if (preparedPathCanBeReused(path, { allowPrepared, preparedBaseline, hasPreparedContext })) continue;
    conflicts.push(path);
  }
  // Any pre-existing generated-root file is a user-owned asset unless it is
  // the exact empty index produced by prepare.  Refuse before writing config
  // or checklist so an apply conflict cannot leave a partial initialization.
  async function visit(relativeDirectory) {
    const directory = join(root, ...relativeDirectory.split('/'));
    if (!await exists(directory)) return;
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const relativePath = `${relativeDirectory}/${entry.name}`;
      if (entry.isDirectory()) await visit(relativePath);
      else if (entry.isFile()) {
        if (relativePath === 'docs/function/module.json') {
          try {
            const value = JSON.parse(await readFile(join(root, ...relativePath.split('/')), 'utf8'));
            if (JSON.stringify(value) === JSON.stringify({ schemaVersion: '1.0', modules: [] })) continue;
          } catch { /* malformed user content remains a conflict */ }
        }
        if (!preparedPathCanBeReused(relativePath, { allowPrepared, preparedBaseline, hasPreparedContext })) conflicts.push(relativePath);
      }
    }
  }
  await visit('docs/knowledge/modules');
  await visit('docs/function');
  await visit('.codebuddy/rules');
  return [...new Set(conflicts)].sort();
}

async function reusablePreparedAssetErrors(root, relativePath, { expectedPaths = null } = {}) {
  const target = join(root, ...relativePath.split('/'));
  let text;
  try { text = await readFile(target, 'utf8'); }
  catch (error) { return [`${relativePath} cannot be read: ${error.message}`]; }
  if (/<[^>\r\n]+>/.test(text)) return [`${relativePath} still contains an unresolved placeholder`];
  if (relativePath.endsWith('.puml') && !/@startuml[\s\S]*@enduml/.test(text)) return [`${relativePath} is not a complete PlantUML document`];
  if (relativePath.endsWith('.svg') && !/^\s*(?:<\?xml[\s\S]*?>\s*)?<svg\b[\s\S]*<\/svg>\s*$/i.test(text)) return [`${relativePath} is not a complete SVG document`];
  if (relativePath.endsWith('.json')) {
    try {
      const value = JSON.parse(text);
      if (relativePath === 'docs/function/module.json' && (value?.schemaVersion !== '1.0' || !Array.isArray(value.modules))) return [`${relativePath} has an invalid module index`];
      if (relativePath.endsWith('/function.json') && (!Array.isArray(value?.functions) || Object.keys(value).some((key) => key !== 'functions'))) return [`${relativePath} has an invalid function index`];
    } catch (error) { return [`${relativePath} is not valid JSON: ${error.message}`]; }
    return [];
  }
  return validateCompletedDocument(relativePath, text, relativePath.endsWith('文件树.md') ? { expectedPaths } : {});
}

function preparedFileTreeSkeleton(text) {
  if (/<[^>\r\n]+>/.test(text)) return false;
  const lines = String(text).split(/\r?\n/).filter((line) => line.trim());
  return lines.every((line) => {
    if (line.startsWith('# 文件树') || line.startsWith('初始化分工骨架：') || line.startsWith('全量项目导航：')) return true;
    return /^\s*- `[^`]+`\/?$/.test(line);
  });
}

const SCAN_IGNORED_DIRECTORIES = new Set(['.git', 'node_modules']);

function normalProjectPath(path) { return path.replaceAll('\\', '/'); }
function isExcludedPath(path, excluded) { return [...excluded].some((prefix) => path === prefix || path.startsWith(`${prefix}/`)); }

async function classifyProjectFile(path) {
  let handle;
  try {
    handle = await open(path, 'r');
    const sample = Buffer.alloc(8192);
    const { bytesRead } = await handle.read(sample, 0, sample.length, 0);
    return sample.subarray(0, bytesRead).includes(0) ? 'binary_or_non_text' : 'readable_text';
  } catch {
    return 'unreadable';
  } finally {
    await handle?.close();
  }
}

/**
 * Enumerate every visible project file without treating any conventional name or
 * directory as the source-of-truth for raw material.  The only exclusions are
 * VCS/dependency internals and caller supplied generated runtime subtrees.
 */
export async function scanProjectMaterials(projectRoot, { exclude = ['.codebuddy/workflows'] } = {}) {
  const root = resolve(projectRoot);
  const excluded = new Set(exclude.map((path) => normalProjectPath(path).replace(/^\/+|\/+$/g, '')));
  const files = [];
  async function walk(directory) {
    const entries = (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (SCAN_IGNORED_DIRECTORIES.has(entry.name)) continue;
      const absolutePath = join(directory, entry.name);
      const relativePath = normalProjectPath(relative(root, absolutePath));
      if (isExcludedPath(relativePath, excluded)) continue;
      if (entry.isSymbolicLink()) { files.push({ path: relativePath, classification: 'symbolic_link' }); continue; }
      if (entry.isDirectory()) await walk(absolutePath);
      else if (entry.isFile()) files.push({ path: relativePath, classification: await classifyProjectFile(absolutePath) });
    }
  }
  await walk(root);
  return files;
}

export function validateChecklist(value) {
  const errors = [];
  if (!value || typeof value !== 'object' || Object.keys(value).length !== 2 || !Object.hasOwn(value, 'schemaVersion') || !Object.hasOwn(value, 'items') || value.schemaVersion !== '1.0' || !Array.isArray(value.items) || value.items.length !== CHECKLIST_IDS.length) return ['checklist must contain exactly eight canonical items'];
  const ids = new Set();
  for (const item of value.items) {
    if (!item || typeof item !== 'object' || Object.keys(item).some((key) => !CHECKLIST_KEYS.has(key))) { errors.push('checklist item has unknown field'); continue; }
    if (!CHECKLIST_IDS.includes(item.id) || ids.has(item.id)) errors.push('checklist ids must be unique and canonical'); ids.add(item.id);
    if (item.label !== CHECKLIST_LABELS[item.id]) errors.push('checklist label does not match canonical item');
    if (!['pending', 'confirmed'].includes(item.status)) errors.push('checklist status is invalid');
    if (item.status === 'confirmed' && (!(typeof item.actor === 'string' && item.actor.trim()) || !validTime(item.confirmedAt))) errors.push('confirmed checklist item requires actor and RFC3339 timestamp');
    if (item.status === 'pending' && (item.actor !== null || item.confirmedAt !== null)) errors.push('pending checklist item cannot carry confirmation metadata');
  }
  for (const id of CHECKLIST_IDS) if (!ids.has(id)) errors.push('checklist is missing canonical item');
  return errors;
}

function newChecklist() { return { schemaVersion: '1.0', items: CHECKLIST_IDS.map((id) => ({ id, label: CHECKLIST_LABELS[id], status: 'pending', actor: null, confirmedAt: null })) }; }

const LANGUAGE_MARKERS = Object.freeze([
  ['go.mod', 'go', 'go'], ['Cargo.toml', 'rust', 'cargo'], ['composer.json', 'php', 'composer'],
  ['pyproject.toml', 'python', 'pip'], ['requirements.txt', 'python', 'pip'], ['setup.py', 'python', 'pip'],
  ['pom.xml', 'java', 'maven'], ['build.gradle', 'java', 'gradle'], ['build.gradle.kts', 'java', 'gradle']
]);

async function readTextIfExists(path, limit = 65536) {
  if (!await exists(path)) return null;
  try { return (await readFile(path, 'utf8')).slice(0, limit); } catch { return null; }
}

export async function discoverProject(root) {
  // The complete inventory is intentionally the first discovery action. Later
  // marker checks are optional technical hints, never a filter on materials.
  const scannedFiles = await scanProjectMaterials(root, { exclude: ['.codebuddy/workflows'] });
  const scannedEntries = await visibleProjectEntries(root, new Set(['.codebuddy/workflows']));
  const classificationByPath = new Map(scannedFiles.map((entry) => [entry.path, entry.classification]));
  const packagePath = join(root, 'package.json');
  let packageJson = {};
  if (await exists(packagePath)) { try { packageJson = JSON.parse(await readFile(packagePath, 'utf8')); } catch { packageJson = {}; } }
  const sourceRoots = (await Promise.all(['src', 'app', 'lib', 'internal', 'cmd', 'pkg', 'server'].map(async (name) => (await exists(join(root, name))) ? name : null))).filter(Boolean);
  const testRoots = (await Promise.all(['test', 'tests', 'spec'].map(async (name) => (await exists(join(root, name))) ? name : null))).filter(Boolean);
  const scripts = packageJson.scripts && typeof packageJson.scripts === 'object' ? packageJson.scripts : {};
  const hasNpm = await exists(join(root, 'package-lock.json')) || await exists(join(root, 'npm-shrinkwrap.json'));
  const gateFor = (name) => scripts[name] && hasNpm ? { id: `project-${name}`, command: 'npm', args: ['run', name], cwd: '.', timeoutSeconds: name === 'test' ? 900 : 600, required: true } : null;
  const checks = ['lint', 'typecheck', 'test', 'build'].map(gateFor).filter(Boolean);
  const stack = [];
  if (packageJson.name || hasNpm) stack.push('node');
  const languageMarkers = [];
  for (const [marker, language, manager] of LANGUAGE_MARKERS) {
    if (await exists(join(root, marker))) { stack.push(language); languageMarkers.push({ marker, language, manager }); }
  }
  const readme = await readTextIfExists(join(root, 'README.md')) ?? await readTextIfExists(join(root, 'README.rst')) ?? await readTextIfExists(join(root, 'README.txt'));
  const goMod = await readTextIfExists(join(root, 'go.mod'));
  const frameworkHints = [];
  if (goMod) {
    for (const dependency of goMod.split(/\r?\n/)) {
      const match = dependency.match(/^\s*(?:require\s+)?([\w./-]+)\s+v[\w.-]+/);
      if (match && /gin-gonic|golang\/etcd|go-kratos|go-zero|gRPC/.test(match[1])) frameworkHints.push(match[1].split('/').pop());
    }
  }
  return {
    stack, packageManager: hasNpm ? 'npm' : (languageMarkers[0]?.manager ?? 'none'),
    sourceRoots, testRoots, gates: checks,
    readme: readme ? { present: true, excerpt: readme.slice(0, 2000) } : { present: false },
    languageMarkers, frameworkHints, fileTree: await previewFileTree(root),
    fullScan: {
      scope: 'every visible project file and directory; excludes only .git, node_modules and .codebuddy/workflows',
      files: scannedFiles,
      directories: scannedEntries.filter((path) => path.endsWith('/')).map((path) => ({ path: path.slice(0, -1), classification: 'directory' })),
      entries: scannedEntries.map((path) => path.endsWith('/')
        ? { path: path.slice(0, -1), kind: 'directory', classification: 'directory' }
        : { path, kind: 'file', classification: classificationByPath.get(path) ?? 'unreadable' })
    },
    unrecognized: ['workItem', 'codeReview', 'ci', ...(scripts && !hasNpm ? ['packageManager'] : []), ...(stack.length === 0 ? ['stack'] : [])]
  };
}

const KNOWLEDGE_ROOT_KEYS = new Set(['schemaVersion', 'project', 'businessModules', 'engineeringModules', 'componentDiagram', 'fileTreeDescriptions', 'ruleAdjustments']);
const PROJECT_KEYS = new Set(['purpose', 'stack', 'architecture', 'entrypoints', 'topModules', 'unrecognized', 'evidence']);
const ARCHITECTURE_KEYS = new Set(['style', 'layers', 'components', 'dependencyDirection', 'dataFlows', 'boundaries', 'diagramPath', 'evidence']);
const MODULE_KEYS = new Set(['module', 'features']);
const FEATURE_KEYS = new Set(['name', 'currentStatus', 'currentCapability', 'businessRules', 'boundaries', 'mainFlow', 'engineeringEntrypoints', 'evidence']);
const ENGINEERING_MODULE_KEYS = new Set(['name', 'modulePosition', 'directoryAndEntrypoints', 'coreComponents', 'mainFlow', 'crossComponentRelations', 'compatibilityBoundary', 'activationMechanism', 'easyMisjudgments', 'evidence']);
const RULE_ADJUSTMENT_KEYS = new Set(['scope', 'mustFollow', 'knowledgePaths', 'verification', 'updateThreshold']);

function knowledgeDraftError(value, violation) { return new Error(`invalid init knowledge draft: ${violation}`); }
function safeKnowledgeName(value) {
  return typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 100 &&
    !/[<>:"/\\|?*\x00-\x1f]/.test(value) && !['.', '..'].includes(value) && !/[. ]$/.test(value) &&
    !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value);
}

export function validateKnowledgeDraft(value, { sourceFiles = null } = {}) {
  const violations = [];
  const text = JSON.stringify(value ?? null);
  const placeholder = /<[^>\r\n]+>/.exec(text);
  if (placeholder) violations.push(`placeholder ${placeholder[0]} must be replaced with real content`);
  if (/\{\{[^}]+\}\}/.test(text)) violations.push('Mustache placeholders are not allowed in the knowledge draft');
  if (/(?:用途待项目管理员确认|用途待确认|待补充|尚未|未提供|暂无|未知|TODO|TBD)/i.test(text)) violations.push('draft must contain concrete facts rather than generic or pending descriptions');
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw knowledgeDraftError(value, 'draft must be an object');
  const keys = Object.keys(value);
  if (value.schemaVersion !== '1.0' || keys.some((key) => !KNOWLEDGE_ROOT_KEYS.has(key))) violations.push('draft must carry schemaVersion 1.0 and only canonical keys');
  const list = (candidate, name, { allowEmpty = false } = {}) => {
    if (!Array.isArray(candidate) || (!allowEmpty && candidate.length === 0) || candidate.some((item) => typeof item !== 'string' || !item.trim())) {
      violations.push(`${name} must be a ${allowEmpty ? 'possibly empty' : 'non-empty'} array of strings`); return false;
    }
    return true;
  };
  const objectWith = (candidate, keys, name) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate) || Object.keys(candidate).some((key) => !keys.has(key))) {
      violations.push(`${name} has unknown or missing fields`); return false;
    }
    return true;
  };
  const project = value.project;
  const projectOk = objectWith(project, PROJECT_KEYS, 'project') &&
    typeof project.purpose === 'string' && project.purpose.trim() &&
    list(project.stack, 'project.stack') && list(project.entrypoints, 'project.entrypoints') &&
    list(project.topModules, 'project.topModules', { allowEmpty: true }) && list(project.unrecognized, 'project.unrecognized', { allowEmpty: true }) &&
    list(project.evidence, 'project.evidence') && objectWith(project.architecture, ARCHITECTURE_KEYS, 'project.architecture') &&
    typeof project.architecture.style === 'string' && project.architecture.style.trim() &&
    list(project.architecture.layers, 'project.architecture.layers') && list(project.architecture.components, 'project.architecture.components') &&
    typeof project.architecture.dependencyDirection === 'string' && project.architecture.dependencyDirection.trim() &&
    list(project.architecture.dataFlows, 'project.architecture.dataFlows') && list(project.architecture.boundaries, 'project.architecture.boundaries') &&
    typeof project.architecture.diagramPath === 'string' && project.architecture.diagramPath.trim() && list(project.architecture.evidence, 'project.architecture.evidence');
  if (!projectOk) violations.push('project must carry purpose, architecture and evidence fields');
  if (!Array.isArray(value.businessModules)) violations.push('businessModules must be an array');
  else {
    const businessModuleNames = new Set();
    for (const module of value.businessModules) {
    if (!module || typeof module !== 'object' || Array.isArray(module) || Object.keys(module).some((key) => !MODULE_KEYS.has(key)) || !safeKnowledgeName(module.module) || !Array.isArray(module.features)) { violations.push('businessModules entries must carry a safe module name and features'); break; }
    if (businessModuleNames.has(module.module)) { violations.push('businessModules names must be unique'); break; }
    businessModuleNames.add(module.module);
    const featureNames = new Set();
    if (module.features.some((feature) => {
      if (!feature || typeof feature !== 'object' || Array.isArray(feature) || Object.keys(feature).some((key) => !FEATURE_KEYS.has(key)) || !safeKnowledgeName(feature.name) || featureNames.has(feature.name) || !['currentStatus', 'currentCapability', 'businessRules', 'boundaries', 'mainFlow'].every((key) => typeof feature[key] === 'string' && feature[key].trim()) || !list(feature.engineeringEntrypoints, 'feature.engineeringEntrypoints') || !list(feature.evidence, 'feature.evidence')) return true;
      featureNames.add(feature.name); return false;
    })) { violations.push('feature entries must carry unique safe names, current function sections and evidence'); break; }
    }
  }
  if (!Array.isArray(value.engineeringModules)) violations.push('engineeringModules must be an array');
  else {
    const engineeringNames = new Set();
    for (const module of value.engineeringModules) {
    if (!module || typeof module !== 'object' || Array.isArray(module) || Object.keys(module).some((key) => !ENGINEERING_MODULE_KEYS.has(key)) ||
        !safeKnowledgeName(module.name) || engineeringNames.has(module.name) ||
        !['modulePosition', 'directoryAndEntrypoints', 'coreComponents', 'mainFlow', 'crossComponentRelations', 'compatibilityBoundary', 'activationMechanism', 'easyMisjudgments'].every((key) => typeof module[key] === 'string' && module[key].trim()) || !list(module.evidence, 'engineering module evidence')) { violations.push('engineeringModules entries must carry all module sections and evidence'); break; }
    engineeringNames.add(module.name);
    }
  }
  if (typeof value.componentDiagram !== 'string' || !/@startuml[\s\S]*@enduml/.test(value.componentDiagram)) violations.push('componentDiagram must be PlantUML text between @startuml and @enduml');
  if (!value.componentDiagram.includes('@startuml') || !value.componentDiagram.includes('@enduml')) violations.push('componentDiagram must be PlantUML text');
  const treeDescriptionKeys = value.fileTreeDescriptions && typeof value.fileTreeDescriptions === 'object' && !Array.isArray(value.fileTreeDescriptions) ? Object.keys(value.fileTreeDescriptions) : [];
  const treePathKeys = treeDescriptionKeys.map((path) => String(path).replaceAll('\\', '/'));
  const invalidTreePath = treePathKeys.some((path) => {
    const withoutTrailingSlash = path.replace(/\/$/, '');
    return !withoutTrailingSlash || path.startsWith('/') || /^[A-Za-z]:\//.test(path) || withoutTrailingSlash.split('/').some((segment) => !segment || segment === '.' || segment === '..');
  });
  const duplicateTreePath = new Set(treePathKeys.map((path) => path.replace(/\/$/, ''))).size !== treePathKeys.length;
  if (!value.fileTreeDescriptions || typeof value.fileTreeDescriptions !== 'object' || Array.isArray(value.fileTreeDescriptions) || invalidTreePath || duplicateTreePath || Object.values(value.fileTreeDescriptions).some((item) => typeof item !== 'string' || !item.trim() || /(?:用途待确认|用途待项目管理员确认|业务逻辑|源码目录|配置文件|目录用途)/.test(item))) violations.push('fileTreeDescriptions must map relative paths to concrete descriptions');
  if (sourceFiles) {
    const documented = Object.keys(value.fileTreeDescriptions ?? {}).sort();
    const expected = [...sourceFiles].sort();
    const documentedNormalised = new Set(documented.map((path) => String(path).replace(/\/$/, '')));
    const expectedNormalised = new Set(expected.map((path) => String(path).replace(/\/$/, '')));
    const missing = [...expectedNormalised].filter((path) => !documentedNormalised.has(path));
    const unexpected = [...documentedNormalised].filter((path) => !expectedNormalised.has(path));
    if (missing.length || unexpected.length) violations.push(`file tree descriptions must match generated project files; missing: ${missing.join(', ') || 'none'}; unexpected: ${unexpected.join(', ') || 'none'}`);
    if (sourceFiles.size > 0) {
      const evidenceCollections = [
        ['project.evidence', project?.evidence],
        ['project.architecture.evidence', project?.architecture?.evidence],
        ...((Array.isArray(value.businessModules) ? value.businessModules : []).flatMap((module) => module.features.map((feature) => [`feature ${module.module}/${feature.name} evidence`, feature.evidence]))),
        ...((Array.isArray(value.engineeringModules) ? value.engineeringModules : []).map((module) => [`engineering module ${module.name} evidence`, module.evidence]))
      ];
      for (const [name, paths] of evidenceCollections) for (const rawPath of Array.isArray(paths) ? paths : []) {
        const path = String(rawPath).replaceAll('\\', '/').replace(/^\.\//, '');
        if (!path || path.startsWith('/') || /^[A-Za-z]:\//.test(path) || path.split('/').includes('..') || !expectedNormalised.has(path.replace(/\/$/, ''))) violations.push(`${name} contains an evidence path not present in the scanned project: ${rawPath}`);
      }
    }
  }
  const allEvidenceCollections = [
    ['project.evidence', project?.evidence],
    ['project.architecture.evidence', project?.architecture?.evidence],
    ...((Array.isArray(value.businessModules) ? value.businessModules : []).flatMap((module) => module.features.map((feature) => [`feature ${module.module}/${feature.name} evidence`, feature.evidence]))),
    ...((Array.isArray(value.engineeringModules) ? value.engineeringModules : []).map((module) => [`engineering module ${module.name} evidence`, module.evidence]))
  ];
  for (const [name, paths] of allEvidenceCollections) for (const rawPath of Array.isArray(paths) ? paths : []) {
    const path = String(rawPath).replaceAll('\\', '/').replace(/^\.\//, '');
    if (!path || path.startsWith('/') || /^[A-Za-z]:\//.test(path) || path.split('/').includes('..')) violations.push(`${name} contains an unsafe evidence path: ${rawPath}`);
  }
  const rulePathAllowed = (rawPath) => {
    const path = String(rawPath).replaceAll('\\', '/').replace(/^\.\//, '');
    if (path.startsWith('docs/knowledge/') || path.startsWith('docs/function/')) return true;
    // Source links are allowed only when they identify a nested project path;
    // a root package/config filename is not a knowledge entry.
    return Boolean(sourceFiles?.has(path) && path.includes('/'));
  };
  if (!value.ruleAdjustments || typeof value.ruleAdjustments !== 'object' || Array.isArray(value.ruleAdjustments) ||
      Object.keys(value.ruleAdjustments).some((key) => !RULE_FILES.includes(key)) ||
      RULE_FILES.some((key) => !Object.hasOwn(value.ruleAdjustments, key)) ||
      Object.values(value.ruleAdjustments).some((rule) => !objectWith(rule, RULE_ADJUSTMENT_KEYS, 'rule adjustment') || typeof rule.scope !== 'string' || !rule.scope.trim() || /^(?:通用|随时|任何时候|默认)$/u.test(rule.scope.trim()) || !list(rule.mustFollow, 'rule mustFollow') || !list(rule.knowledgePaths, 'rule knowledgePaths') || rule.knowledgePaths.some((path) => !rulePathAllowed(path)) || !list(rule.verification, 'rule verification') || !list(rule.updateThreshold, 'rule updateThreshold'))) violations.push('ruleAdjustments must carry structured fields for every canonical Rule');
  if (violations.length) throw knowledgeDraftError(value, violations.join('; '));
  return value;
}

function discoveredConfig(discovery) { return { schemaVersion: '1.0', adapterVersion: '0.8.0', project: { stack: discovery.stack, packageManager: discovery.packageManager, sourceRoots: discovery.sourceRoots, testRoots: discovery.testRoots }, protectedContracts: ['CODEBUDDY.md', 'docs/', '.codebuddy/settings.json', '.codebuddy/harness.json', '.codebuddy/onboarding-checklist.json', '.codebuddy/rules/', '.codebuddy/agents/'], gates: { preCommit: discovery.gates.filter((gate) => gate.id !== 'project-build'), ci: discovery.gates }, integrations: { workItem: 'none', codeReview: 'none', ci: 'none' } }; }

export async function initializeProject(projectRoot, { apply = false, knowledgeDraft = null, phase = null, sourceEntries = null } = {}) {
  const prepareOnly = phase === 'prepare';
  const shouldApply = apply || phase === 'finalize';
  const root = resolve(projectRoot); const created = []; const updated = []; const conflicts = []; const discovery = await discoverProject(root);
  if (shouldApply && knowledgeDraft === null) throw new Error('a complete knowledge draft is required before initialization can apply');
  if (prepareOnly && knowledgeDraft !== null) throw new Error('prepare phase cannot write a knowledge draft');
  if (shouldApply) {
    const checklistPath = join(root, '.codebuddy', 'onboarding-checklist.json');
    let checklist;
    try { checklist = JSON.parse(await readFile(checklistPath, 'utf8')); }
    catch (error) { throw new Error(`a valid onboarding checklist is required before applying initialization: ${error.message}`); }
    const checklistErrors = validateChecklist(checklist);
    if (checklistErrors.length) throw new Error(`a valid onboarding checklist is required before applying initialization: ${checklistErrors.join('; ')}`);
    const pending = checklist.items.filter((item) => item.status !== 'confirmed').map((item) => item.id);
    if (pending.length) throw new Error(`all onboarding checklist items must be confirmed before applying initialization: ${pending.join(', ')}`);
  }
  const draftPath = typeof knowledgeDraft === 'string' ? resolve(knowledgeDraft) : null;
  const preparedRecord = phase === 'finalize' ? preparedScans.get(root) : null;
  const preparedSourceEntries = Array.isArray(preparedRecord) ? preparedRecord : preparedRecord?.sourceEntries;
  // `sourceEntries` is an output/input hint for draft tree validation only; it
  // is never treated as proof that a long-lived asset came from prepare.  Only
  // the in-process prepare inventory can authorize reuse, avoiding an API
  // caller accidentally using a partial list to overwrite user documents.
  const preparedBaseline = new Set(Array.isArray(preparedRecord?.baselineEntries) ? preparedRecord.baselineEntries : []);
  const hasPreparedContext = preparedRecord != null;
  const scanExclusions = new Set(['.codebuddy/workflows']);
  if (draftPath) scanExclusions.add(normalProjectPath(relative(root, draftPath)));
  if (phase === 'finalize') for (const path of PREPARED_SCAN_EXCLUSIONS) scanExclusions.add(path);
  const scannedAfterPrepare = phase === 'finalize'
    ? await sourceEntriesAfterPrepare(root, draftPath ? [normalProjectPath(relative(root, draftPath))] : [], {
      '.codebuddy/harness.json': discoveredConfig(discovery),
      '.codebuddy/onboarding-checklist.json': newChecklist()
    })
    : await visibleProjectEntries(root, scanExclusions);
  const sourceFiles = phase === 'finalize'
    ? new Set(sourceEntries ?? (draftPath ? scannedAfterPrepare : preparedSourceEntries ?? scannedAfterPrepare))
    : scannedAfterPrepare;
  const draft = knowledgeDraft === null ? null : validateKnowledgeDraft(typeof knowledgeDraft === 'string' ? JSON.parse(await readFile(knowledgeDraft, 'utf8')) : knowledgeDraft, { sourceFiles: new Set(sourceFiles) });
  if (shouldApply) {
    const knowledgeConflicts = await existingKnowledgeAssets(root, draft, { allowPrepared: phase === 'finalize', preparedBaseline, hasPreparedContext });
    conflicts.push(...knowledgeConflicts);
  }
  const copies = [];
  for (const source of await files(templateRoot)) {
    const targetRelative = relative(templateRoot, source).replaceAll('\\', '/');
    if (!PREPARE_TEMPLATE_PATHS.has(targetRelative)) continue;
    // The empty function index is a prepare scaffold only.  In a direct
    // apply, or after a caller supplies a completed draft, let the writer
    // create it so an existing user index is detected as a conflict rather
    // than being copied and silently replaced.
    if (targetRelative === 'docs/function/module.json' && !prepareOnly && phase !== 'finalize') continue;
    const target = join(root, ...targetRelative.split('/'));
    if (await exists(target)) {
      // `phase=finalize` is the explicit continuation of a prepare run.  The
      // static files may be reused only when they are still byte-identical to
      // the plugin source; user edits remain a conflict and are never erased.
      if (phase === 'finalize') {
        const existing = await readFile(target);
        const original = await readFile(source);
        const isPreparedTree = targetRelative === 'docs/knowledge/文件树.md' && preparedFileTreeSkeleton(existing.toString('utf8'));
        if (!existing.equals(original) && !isPreparedTree) {
          // Static prepare assets are owned by the initializer and must not be
          // edited between phases. The runtime is also the sole file-tree
          // writer, so a completed-looking tree from a subagent is a conflict.
          conflicts.push(targetRelative);
        }
      } else conflicts.push(targetRelative);
    } else { created.push(targetRelative); copies.push([source, target]); }
  }
  const generated = [];
  for (const [relativePath, value] of [['.codebuddy/harness.json', discoveredConfig(discovery)], ['.codebuddy/onboarding-checklist.json', newChecklist()]]) {
    const target = join(root, ...relativePath.split('/'));
    if (await exists(target)) {
      if (phase === 'finalize' && relativePath === '.codebuddy/onboarding-checklist.json') {
        try { validateChecklist(JSON.parse(await readFile(target, 'utf8'))); }
        catch { conflicts.push(relativePath); }
      } else if (phase === 'finalize' && relativePath === '.codebuddy/harness.json') {
        try {
          const existing = JSON.parse(await readFile(target, 'utf8'));
          if (JSON.stringify(existing) !== JSON.stringify(value)) conflicts.push(relativePath);
        } catch { conflicts.push(relativePath); }
      } else conflicts.push(relativePath);
    } else { created.push(relativePath); generated.push([target, value]); }
  }
  for (const agentName of AGENT_DEFINITION_FILES) {
    const agentPath = `.codebuddy/agents/${agentName}`;
    const target = join(root, ...agentPath.split('/'));
    if (await exists(target)) {
      if (phase === 'finalize') {
        const existing = await readFile(target);
        const original = await readFile(join(pluginRoot, 'agents', agentName));
        if (!existing.equals(original)) conflicts.push(agentPath);
      } else conflicts.push(agentPath);
    } else {
      created.push(agentPath);
      copies.push([join(pluginRoot, 'agents', agentName), target]);
    }
  }
  const ignorePath = join(root, '.gitignore');
  let ignoreText = '';
  if (await exists(ignorePath)) ignoreText = await readFile(ignorePath, 'utf8');
  const ignoreLines = ignoreText.split(/\r?\n/).map((line) => line.trim());
  if (!ignoreLines.includes('.codebuddy/workflows/')) {
    if (await exists(ignorePath)) updated.push('.gitignore'); else created.push('.gitignore');
  }
  if ((shouldApply || prepareOnly) && conflicts.length === 0) {
    for (const [source, target] of copies) { await mkdir(dirname(target), { recursive: true }); await copyFile(source, target); }
    for (const [target, value] of generated) { await mkdir(dirname(target), { recursive: true }); await writeJsonAtomic(target, value); }
    if (!ignoreLines.includes('.codebuddy/workflows/')) {
      const separator = ignoreText && !ignoreText.endsWith('\n') ? '\n' : '';
      await writeFile(ignorePath, `${ignoreText}${separator}.codebuddy/workflows/\n`);
    }
    const treeOptions = draftPath ? { skeleton: true, exclude: [normalProjectPath(relative(root, draftPath))] } : { skeleton: true };
    await refreshFileTree(root, null, treeOptions);
    if (prepareOnly) {
      preparedScans.set(root, { sourceEntries: [...sourceFiles], baselineEntries: [...scannedAfterPrepare] });
      return { ok: true, apply: false, phase: 'prepared', created, updated, conflicts, discovery, knowledgeFilled: false, sourceEntries: [...sourceFiles], requiredFiles: CANONICAL_PROJECT_FILES };
    }
    await applyKnowledgeDraft(root, draft, { allowPrepared: phase === 'finalize', preparedBaseline, hasPreparedContext });
    await refreshFileTree(root, draft.fileTreeDescriptions, draftPath ? { exclude: [normalProjectPath(relative(root, draftPath))] } : {});
    return { ok: true, apply: shouldApply, phase: phase ?? 'finalize', created, updated, conflicts, discovery, knowledgeFilled: true, requiredFiles: CANONICAL_PROJECT_FILES };
  }
  return { ok: conflicts.length === 0, apply: shouldApply, phase: phase ?? 'discover', created, updated, conflicts, discovery, knowledgeFilled: false, requiredFiles: CANONICAL_PROJECT_FILES };
}

function markdownList(items) { return items.map((item) => `- ${item}`).join('\n'); }
function evidenceLines(paths) { return paths.map((path) => `- \`${path}\``).join('\n'); }
function tableValue(value) { return String(value).replace(/[\r\n|]/g, ' ').trim(); }

async function applyKnowledgeDraft(root, draft, { allowPrepared = false, preparedBaseline = new Set(), hasPreparedContext = false } = {}) {
  const { stack, entrypoints, topModules, unrecognized, purpose, architecture, evidence } = draft.project;
  const overview = [
    '# 项目总览', '',
    '## 项目用途', '', purpose, '',
    '## 技术栈', '', markdownList(stack), '',
    '## 软件设计架构', '',
    `- 架构风格：${architecture.style}`,
    `- 分层与组件：${architecture.layers.join('；')}；${architecture.components.join('；')}`,
    `- 依赖方向：${architecture.dependencyDirection}`,
    `- 主要请求或数据流：${architecture.dataFlows.join('；')}`,
    `- 关键边界：${architecture.boundaries.join('；')}`,
    `- 架构图：[组件图源](architecture/component.puml) 与 [SVG 渲染](architecture/component.svg)`, '',
    '## 启动、构建与测试入口', '', markdownList(entrypoints), '',
    '## 顶层模块', '', topModules.length ? markdownList(topModules) : '- 未识别顶层模块', '',
    '## 未识别项', '', unrecognized.length ? markdownList(unrecognized) : '- 无', '',
    '## 事实依据', '', evidenceLines([...new Set([...evidence, ...architecture.evidence])])
  ].join('\n');
  const rows = [];
  for (const module of draft.businessModules) for (const feature of module.features) {
    const knowledgePath = `docs/function/${module.module}/${feature.name}/功能描述.md`;
    const engineeringPath = feature.engineeringEntrypoints[0] ?? architecture.diagramPath;
    rows.push(`| ${tableValue(`${module.module}/${feature.name} 场景`)} | ${tableValue(`${module.module}/${feature.name}`)} | [功能描述](${knowledgePath.replace(/^docs\//, '../../')}) | ${tableValue(engineeringPath)} | ${tableValue(feature.engineeringEntrypoints.join('、'))} |`);
  }
  if (!rows.length) rows.push('| 尚未识别业务场景 | 暂无 | [文件树](文件树.md) | [架构图](architecture/component.svg) | 见事实依据 |');
  const entry = ['# 业务入口', '', '仅负责从业务问题定位业务知识、工程知识和源码入口，不复制 Rules 正文。', '', '| 业务问题/场景 | 业务模块/功能点 | 优先阅读的业务知识 | 工程知识入口 | 源码/配置入口 |', '| --- | --- | --- | --- | --- |', ...rows].join('\n');
  const writes = [
    ['docs/knowledge/项目总览.md', overview],
    ['docs/knowledge/业务入口.md', entry],
    ['docs/knowledge/architecture/component.puml', draft.componentDiagram],
    ['docs/knowledge/architecture/component.svg', renderComponentSvg(draft.componentDiagram)]
  ];
  for (const module of draft.engineeringModules) {
    writes.push([`docs/knowledge/modules/${module.name}.md`, [
      `# ${module.name}`, '',
      '## 模块定位', '', module.modulePosition, '',
      '## 目录与入口', '', module.directoryAndEntrypoints, '',
      '## 核心组成', '', module.coreComponents, '',
      '## 主要流程', '', module.mainFlow, '',
      '## 跨端关系', '', module.crossComponentRelations, '',
      '## 兼容边界', '', module.compatibilityBoundary, '',
      '## 生效机制', '', module.activationMechanism, '',
      '## 易误判点', '', module.easyMisjudgments, '',
      '## 事实依据', '', evidenceLines(module.evidence)
    ].join('\n')]);
  }
  const ruleBaselines = {
    'architecture.md': {
      mustFollow: ['修改模块边界或跨模块依赖前，必须读取架构图、相关工程模块说明与已确认项目级决策；不得在单个任务中私自改变稳定边界。'],
      verification: ['验证依赖方向、跨模块调用与相关集成行为仍符合已确认架构。'],
      updateThreshold: ['已确认的新模块边界、跨模块职责或稳定架构取舍，更新工程模块说明或 docs/knowledge/decisions/。']
    },
    'engineering.md': {
      mustFollow: ['负责人确认且可跨任务复用的工程事实必须按类别回写长期知识，不得只保留在聊天记录或单个 workflow。'],
      verification: ['验证工程模块说明中的入口、机制和兼容边界可由事实依据定位。'],
      updateThreshold: ['工程模块职责、入口、运行机制或易误判点发生长期变化时，更新 docs/knowledge/modules/ 或 docs/knowledge/decisions/。']
    },
    'testing.md': {
      mustFollow: ['涉及 API、数据或集成的变更必须使用相应契约、迁移或消费者验证；不得以单元测试替代兼容性验证。'],
      verification: ['记录本次执行的自动化测试、契约验证、迁移验证或消费者验证及其结果。'],
      updateThreshold: ['已确认的测试边界、验证入口或质量约束可跨任务复用时，更新对应工程模块说明或项目级决策。']
    },
    'api-and-data.md': {
      mustFollow: [
        'API、数据、RPC、事件或外部系统变更前，必须读取对应共享开发知识与权威来源。',
        '不得只改 Markdown；接口以 OpenAPI/IDL，数据以 Migration/DDL，集成以受控 Schema 或适配器配置为准。'
      ],
      verification: ['验证 OpenAPI/IDL、Migration/DDL、受控 Schema 或适配器配置与实现一致，并执行适用的兼容、迁移或消费者验证。'],
      updateThreshold: ['已验收的 API、数据或集成契约变更，必须更新 docs/knowledge/api/、data/ 或 integration/ 的对应条目及索引；实体关系变化同时更新 ER 图。']
    },
    'commit-and-mr.md': {
      mustFollow: ['负责人确认且可跨任务复用的事实不得只留在聊天记录或 workflow；合并前必须经 knowledge-update-review.md 分类并回写正确长期位置。'],
      verification: ['MR 必须列出每项长期知识的需要更新、无需更新或待人裁定结论及证据。'],
      updateThreshold: ['业务、工程、API、数据、集成或项目决策出现已确认且长期有效的变化时，分别更新 docs/function/、docs/knowledge/modules/、api/、data/、integration/ 或 decisions/。']
    }
  };
  for (const rule of RULE_FILES) {
    const adjustment = draft.ruleAdjustments[rule];
    const baseline = ruleBaselines[rule];
    const title = ({ 'architecture.md': '架构规则', 'engineering.md': '工程规则', 'testing.md': '测试规则', 'api-and-data.md': 'API 与数据规则', 'commit-and-mr.md': '提交与 MR 规则' })[rule];
    const ruleText = [
      `适用场景: ${adjustment.scope}`, '', `# ${title}`, '',
      '## 必须遵守', '', markdownList([...baseline.mustFollow, ...adjustment.mustFollow]), '',
      '## 相关知识入口', '', adjustment.knowledgePaths.map((path) => `- [${path}](../../${path})`).join('\n'), '',
      '## 验证方式', '', markdownList([...baseline.verification, ...adjustment.verification]), '',
      '## 更新门槛', '', markdownList([...baseline.updateThreshold, ...adjustment.updateThreshold])
    ].join('\n');
    writes.push([`.codebuddy/rules/${rule}`, ruleText]);
  }
  const moduleIndex = { schemaVersion: '1.0', modules: [] };
  for (const module of draft.businessModules) {
    moduleIndex.modules.push({ id: module.module, name: module.module, aliases: [], path: module.module });
    writes.push([`docs/function/${module.module}/function.json`, JSON.stringify({ functions: module.features.map((feature) => ({ id: feature.name, name: feature.name, aliases: [], path: feature.name })) }, null, 2)]);
    for (const feature of module.features) {
      writes.push([`docs/function/${module.module}/${feature.name}/功能描述.md`, [
        `# ${feature.name}`, '',
        `- 所属业务模块：${module.module}`,
        `- 当前状态：${feature.currentStatus}`, '',
        '## 当前功能', '', feature.currentCapability, '',
        '## 业务规则', '', feature.businessRules, '',
        '## 边界', '', feature.boundaries, '',
        '## 主要流程', '', feature.mainFlow, '',
        '## 事实依据', '', evidenceLines(feature.evidence)
      ].join('\n')]);
      writes.push([`docs/function/${module.module}/${feature.name}/功能演变历史.md`, `# ${feature.name} 功能演变历史\n\n当前没有已验收的历史变化；首次建档依据见同目录的 \`功能描述.md\`。`]);
    }
  }
  writes.push(['docs/function/module.json', JSON.stringify(moduleIndex, null, 2)]);
  for (const [relativePath, text] of writes) {
    if (!relativePath.endsWith('.md')) continue;
    const errors = validateCompletedDocument(relativePath, `${text}\n`);
    if (errors.length) throw new Error(`generated knowledge document violates its Markdown contract (${relativePath}): ${errors.join('; ')}`);
  }
  const conflicts = [];
  for (const [relativePath] of writes) {
    const target = join(root, ...relativePath.split('/'));
    if (!await exists(target)) continue;
    if (allowPrepared && relativePath === 'docs/function/module.json') {
      try {
        const current = JSON.parse(await readFile(target, 'utf8'));
        if (JSON.stringify(current) === JSON.stringify({ schemaVersion: '1.0', modules: [] })) continue;
      } catch { /* fall through to the reusable-asset check */ }
    }
    if (preparedPathCanBeReused(relativePath, { allowPrepared, preparedBaseline, hasPreparedContext })) {
      const errors = await reusablePreparedAssetErrors(root, relativePath, { expectedPaths: preparedBaseline });
      if (errors.length === 0) continue;
    }
    conflicts.push(relativePath);
  }
  if (conflicts.length) throw new Error(`initialization conflicts with existing knowledge assets: ${conflicts.join(', ')}`);
  for (const [relativePath, text] of writes) {
    const target = join(root, ...relativePath.split('/'));
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, `${text}\n`);
  }
}

function xml(value) { return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }
export function renderComponentSvg(plantUml) {
  const title = plantUml.match(/^\s*title\s+(.+)$/mi)?.[1].trim() ?? '项目组件图';
  const nodes = [...new Set([...plantUml.matchAll(/\[([^\]\r\n]+)\]/g)].map((match) => match[1].trim()).filter(Boolean))];
  const width = 760; const rowHeight = 72; const height = Math.max(180, 90 + nodes.length * rowHeight);
  const boxes = nodes.map((node, index) => {
    const y = 64 + index * rowHeight;
    const arrow = index === 0 ? '' : `<line x1="380" y1="${y - 22}" x2="380" y2="${y - 2}" stroke="#4b6b88" stroke-width="2" marker-end="url(#arrow)"/>`;
    return `${arrow}<rect x="180" y="${y}" width="400" height="42" rx="7" fill="#f4f8fc" stroke="#4b6b88"/><text x="380" y="${y + 27}" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="16">${xml(node)}</text>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${xml(title)}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n  <title>${xml(title)}</title>\n  <defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#4b6b88"/></marker></defs>\n  <rect width="100%" height="100%" fill="white"/>\n  <text x="380" y="34" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="20" font-weight="600">${xml(title)}</text>\n  ${boxes}\n</svg>\n`;
}

export async function confirmChecklistItem(projectRoot, { id, actor, at = new Date().toISOString() }) {
  if (!CHECKLIST_IDS.includes(id)) throw new Error(`unknown checklist item: ${id}`);
  if (typeof actor !== 'string' || !actor.trim()) throw new Error('checklist actor is required');
  if (!validTime(at)) throw new Error('checklist timestamp must be RFC3339');
  const path = join(resolve(projectRoot), '.codebuddy', 'onboarding-checklist.json');
  const value = JSON.parse(await readFile(path, 'utf8')); const errors = validateChecklist(value);
  if (errors.length) throw new Error(`invalid onboarding checklist: ${errors.join('; ')}`);
  const item = value.items.find((entry) => entry.id === id);
  if (item.status === 'confirmed') throw new Error(`checklist item already confirmed: ${id}`);
  item.status = 'confirmed'; item.actor = actor.trim(); item.confirmedAt = at;
  await writeJsonAtomic(path, value); return value;
}

export async function checklistStatus(projectRoot) {
  const path = join(resolve(projectRoot), '.codebuddy', 'onboarding-checklist.json');
  const value = JSON.parse(await readFile(path, 'utf8'));
  const errors = validateChecklist(value);
  if (errors.length) throw new Error(`invalid onboarding checklist: ${errors.join('; ')}`);
  const items = value.items.map((item) => ({
    id: item.id,
    label: item.label,
    prompt: CHECKLIST_PROMPTS[item.id],
    confirmed: item.status === 'confirmed',
    ...(item.status === 'confirmed' ? { confirmedBy: item.actor, confirmedAt: item.confirmedAt } : {})
  }));
  return { complete: items.every((item) => item.confirmed), pending: items.filter((item) => !item.confirmed).map((item) => item.id), items };
}
