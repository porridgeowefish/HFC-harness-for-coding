import { lstat, mkdir, readFile, rename, rm, rmdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { refreshFileTree } from './navigation.mjs';
import { validateCompletedDocument } from './markdown-contract.mjs';

const templates = join(dirname(fileURLToPath(import.meta.url)), '..', 'templates');
let temporarySequence = 0;

function segment(value) {
  if (typeof value !== 'string' || !value || value !== value.trim() || value.length > 100 ||
      /[<>:"/\\|?*\x00-\x1f]/.test(value) || ['.', '..'].includes(value) || /[. ]$/.test(value) ||
      /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value)) throw new Error('invalid knowledge name');
  return value;
}

async function stat(path) {
  try { return await lstat(path); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function childPath(root, ...parts) {
  const base = resolve(root);
  const target = resolve(base, ...parts);
  if (target !== base && !target.startsWith(`${base}${sep}`)) throw new Error('knowledge path escapes project root');
  return target;
}

async function rejectSymlinkAncestors(root, ...parts) {
  let current = resolve(root);
  for (const part of parts) {
    current = join(current, part);
    const info = await stat(current);
    if (info?.isSymbolicLink()) throw new Error('symlink knowledge path is unsupported');
    if (info && !info.isDirectory() && part !== parts.at(-1)) throw new Error('knowledge parent is not a directory');
  }
}

async function readOptional(path) {
  try { return await readFile(path, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function factSet(value, required, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} facts are required; natural-language initialization must provide confirmed project facts`);
  const unknown = Object.keys(value).filter((key) => !required.includes(key));
  if (unknown.length) throw new Error(`${label} facts contain unknown fields: ${unknown.join(', ')}`);
  for (const key of required) {
    if (key === 'evidence') {
      if (!Array.isArray(value[key]) || value[key].length === 0 || value[key].some((item) => typeof item !== 'string' || !item.trim() || item.includes('..') || item.startsWith('/') || /^[A-Za-z]:[\\/]/.test(item))) throw new Error(`${label}.${key} must contain relative evidence paths`);
    } else if (typeof value[key] !== 'string' || !value[key].trim() || /(?:待确认|待补充|尚未|未提供|暂无|未知|TODO|TBD)/i.test(value[key])) throw new Error(`${label}.${key} must contain confirmed concrete facts`);
  }
  return value;
}

function fillTemplate(template, replacements) {
  return Object.entries(replacements).reduce((text, [token, value]) => text.replaceAll(`<${token}>`, String(value)), template);
}

function evidenceMarkdown(paths) { return paths.map((path) => `- \`${path}\``).join('\n'); }

async function requireDirectory(path, label) {
  const info = await stat(path);
  if (!info?.isDirectory() || info.isSymbolicLink()) throw new Error(`${label} is missing or invalid; initialize the project first`);
}

function parseIndex(text, fallback, collection, requireSchema) {
  let value;
  try { value = text === null ? structuredClone(fallback) : JSON.parse(text); }
  catch { throw new Error('invalid knowledge index JSON'); }
  const allowedRoot = new Set(requireSchema ? ['schemaVersion', collection] : [collection]);
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some((key) => !allowedRoot.has(key)) ||
      (requireSchema && value.schemaVersion !== '1.0') || !Array.isArray(value[collection])) throw new Error('invalid knowledge index');
  const seen = new Set();
  for (const item of value[collection]) {
    if (!item || typeof item !== 'object' || Array.isArray(item) ||
        Object.keys(item).sort().join(',') !== 'aliases,id,name,path' ||
        !['id', 'name', 'path'].every((key) => typeof item[key] === 'string' && item[key]) ||
        !Array.isArray(item.aliases) || item.aliases.some((alias) => typeof alias !== 'string') ||
        seen.has(item.id) || seen.has(`path:${item.path}`)) throw new Error('invalid knowledge index');
    seen.add(item.id); seen.add(`path:${item.path}`);
  }
  return value;
}

function temporary(path) { temporarySequence += 1; return `${path}.${process.pid}.${Date.now()}.${temporarySequence}.tmp`; }

async function renameWithRetry(source, target) {
  for (let attempt = 0; ; attempt += 1) {
    try { await rename(source, target); return; }
    catch (error) {
      if (!['EPERM', 'EACCES'].includes(error.code) || attempt >= 19) throw error;
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 10));
    }
  }
}

async function atomicText(path, text) {
  const temp = temporary(path);
  try { await writeFile(temp, text, { flag: 'wx' }); await renameWithRetry(temp, path); }
  catch (error) { await unlink(temp).catch(() => {}); throw error; }
}

async function restore(path, original) {
  if (original === null) await unlink(path).catch((error) => { if (error.code !== 'ENOENT') throw error; });
  else await atomicText(path, original);
}

export async function createBusinessFeature(projectRoot, moduleName, featureName, facts = null) {
  const root = resolve(projectRoot); segment(moduleName); segment(featureName);
  const base = childPath(root, 'docs', 'function');
  const moduleDir = childPath(root, 'docs', 'function', moduleName);
  const target = childPath(root, 'docs', 'function', moduleName, featureName);
  await rejectSymlinkAncestors(root, 'docs', 'function', moduleName, featureName);
  if (await stat(target)) throw new Error('knowledge feature already exists');

  const moduleIndexPath = join(base, 'module.json');
  const functionIndexPath = join(moduleDir, 'function.json');
  await requireDirectory(base, 'canonical business knowledge root');
  const [moduleIndexText, functionIndexText, functionTemplate, descriptionTemplate, historyTemplate] = await Promise.all([
    readOptional(moduleIndexPath), readOptional(functionIndexPath),
    readFile(join(templates, 'business', 'function.json'), 'utf8'),
    readFile(join(templates, 'business', '功能描述.md'), 'utf8'),
    readFile(join(templates, 'business', '功能演变历史.md'), 'utf8')
  ]);
  if (moduleIndexText === null) throw new Error('canonical module index is missing; initialize the project first');
  const modules = parseIndex(moduleIndexText, {}, 'modules', true);
  const functions = parseIndex(functionIndexText, JSON.parse(functionTemplate), 'functions', false);
  if (functions.functions.some((item) => item.id === featureName || item.path === featureName)) throw new Error('knowledge feature already indexed');
  const matchingModule = modules.modules.find((item) => item.path === moduleName);
  if (!matchingModule && modules.modules.some((item) => item.id === moduleName)) throw new Error('knowledge module index conflicts with requested name');
  const confirmedFacts = factSet(facts, ['currentStatus', 'currentCapability', 'currentBusinessRules', 'scopeAndExclusions', 'mainBusinessFlow', 'evidence'], 'business feature');
  for (const evidencePath of confirmedFacts.evidence) {
    const info = await stat(childPath(root, ...evidencePath.replaceAll('\\', '/').split('/')));
    if (!info || info.isSymbolicLink()) throw new Error(`business feature evidence path does not exist in the project: ${evidencePath}`);
  }

  const moduleExisted = Boolean(await stat(moduleDir));
  const staging = temporary(target);
  let targetCommitted = false;
  let moduleIndexCommitted = false;
  let functionIndexCommitted = false;
  try {
    await mkdir(moduleDir, { recursive: true });
    await mkdir(staging);
    const description = fillTemplate(descriptionTemplate, {
      'feature-name': featureName,
      'business-module': moduleName,
      'current-status': confirmedFacts.currentStatus,
      'current-capability': confirmedFacts.currentCapability,
      'current-business-rules': confirmedFacts.currentBusinessRules,
      'scope-and-exclusions': confirmedFacts.scopeAndExclusions,
      'main-business-flow': confirmedFacts.mainBusinessFlow,
      'fact-paths': evidenceMarkdown(confirmedFacts.evidence)
    });
    const descriptionErrors = validateCompletedDocument(`docs/function/${moduleName}/${featureName}/功能描述.md`, description);
    if (descriptionErrors.length) throw new Error(`business feature facts do not satisfy the Markdown contract: ${descriptionErrors.join('; ')}`);
    const history = `# ${featureName} 功能演变历史\n\n当前没有已验收的历史变化；首次建档依据见同目录的 \`功能描述.md\`。\n`;
    await writeFile(join(staging, '功能描述.md'), description, { flag: 'wx' });
    await writeFile(join(staging, '功能演变历史.md'), history, { flag: 'wx' });
    await renameWithRetry(staging, target); targetCommitted = true;
    if (!matchingModule) modules.modules.push({ id: moduleName, name: moduleName, aliases: [], path: moduleName });
    functions.functions.push({ id: featureName, name: featureName, aliases: [], path: featureName });
    await atomicText(moduleIndexPath, `${JSON.stringify(modules, null, 2)}\n`); moduleIndexCommitted = true;
    await atomicText(functionIndexPath, `${JSON.stringify(functions, null, 2)}\n`); functionIndexCommitted = true;
    await refreshFileTree(root);
    return { path: relative(root, target).replaceAll('\\', '/') };
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    if (targetCommitted) await rm(target, { recursive: true, force: true });
    if (moduleIndexCommitted) await restore(moduleIndexPath, moduleIndexText);
    if (functionIndexCommitted) await restore(functionIndexPath, functionIndexText);
    if (!moduleExisted) await rmdir(moduleDir).catch((cleanupError) => { if (!['ENOENT', 'ENOTEMPTY'].includes(cleanupError.code)) throw cleanupError; });
    throw error;
  }
}

export async function createEngineeringModule(projectRoot, name, facts = null) {
  const root = resolve(projectRoot); segment(name);
  const knowledgeRoot = childPath(root, 'docs', 'knowledge');
  const targetDirectory = childPath(root, 'docs', 'knowledge', 'modules');
  const target = childPath(root, 'docs', 'knowledge', 'modules', `${name}.md`);
  await rejectSymlinkAncestors(root, 'docs', 'knowledge', 'modules', `${name}.md`);
  await requireDirectory(knowledgeRoot, 'canonical engineering knowledge root');
  if (await stat(target)) throw new Error('engineering module already exists');
  const confirmedFacts = factSet(facts, ['modulePosition', 'directoryAndEntrypoints', 'coreComponents', 'mainFlow', 'crossComponentRelations', 'compatibilityBoundary', 'activationMechanism', 'easyMisjudgments', 'evidence'], 'engineering module');
  for (const evidencePath of confirmedFacts.evidence) {
    const info = await stat(childPath(root, ...evidencePath.replaceAll('\\', '/').split('/')));
    if (!info || info.isSymbolicLink()) throw new Error(`engineering module evidence path does not exist in the project: ${evidencePath}`);
  }
  const directoryExisted = Boolean(await stat(targetDirectory));
  const template = await readFile(join(templates, 'engineering', '模块说明.md'), 'utf8');
  const staging = temporary(target);
  let committed = false;
  try {
    await mkdir(targetDirectory, { recursive: true });
    const moduleDocument = fillTemplate(template, {
      'engineering-module-name': name,
      'module-purpose': confirmedFacts.modulePosition,
      'module-entrypoints': confirmedFacts.directoryAndEntrypoints,
      'module-components': confirmedFacts.coreComponents,
      'module-flow': confirmedFacts.mainFlow,
      'cross-component-relationships': confirmedFacts.crossComponentRelations,
      'compatibility-boundaries': confirmedFacts.compatibilityBoundary,
      'activation-mechanism': confirmedFacts.activationMechanism,
      'non-obvious-facts-and-source-references': confirmedFacts.easyMisjudgments,
      'fact-paths': evidenceMarkdown(confirmedFacts.evidence)
    });
    const moduleErrors = validateCompletedDocument(`docs/knowledge/modules/${name}.md`, moduleDocument);
    if (moduleErrors.length) throw new Error(`engineering module facts do not satisfy the Markdown contract: ${moduleErrors.join('; ')}`);
    await writeFile(staging, moduleDocument, { flag: 'wx' });
    await renameWithRetry(staging, target); committed = true;
    await refreshFileTree(root);
    return { path: relative(root, target).replaceAll('\\', '/') };
  } catch (error) {
    await unlink(staging).catch(() => {});
    if (committed) await unlink(target).catch(() => {});
    if (!directoryExisted) await rmdir(targetDirectory).catch((cleanupError) => { if (!['ENOENT', 'ENOTEMPTY'].includes(cleanupError.code)) throw cleanupError; });
    throw error;
  }
}
