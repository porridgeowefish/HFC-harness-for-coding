import { readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';

const PURPOSES = {
  'CODEBUDDY.md': '常驻项目摘要、Rules 索引与任务触发条件',
  'docs': '项目长期知识、业务功能与工作流记录的统一根目录',
  '.codebuddy': 'Harness 共享配置、Rules、Agent 定义与运行态目录',
  'docs/knowledge/architecture': '架构图源文件与面向人的 SVG 渲染产物',
  'docs/knowledge/modules': '按工程模块拆分的长期技术事实',
  'docs/knowledge': '长期工程事实与源码导航', 'docs/function': '长期业务功能与两级定位索引', 'docs/workflows': '每轮任务的需求、设计、实现与合并记录',
  '.codebuddy/rules': '按操作装配的项目执行规约', '.codebuddy/agents': '项目内独立 Agent 定义与最小权限',
  'docs/workflows': '从需求到合并的任务档案', '.codebuddy': '团队共享配置、Rules 与 Agent 定义',
  '.codebuddy/harness.json': '项目技术栈、门禁命令与平台适配',
  '.codebuddy/settings.json': '插件启用声明', '.codebuddy/onboarding-checklist.json': '八项管理员接入确认',
  '项目总览.md': '项目用途、技术栈、启动构建测试入口', '业务入口.md': '业务问题到知识、源码与配置的导航',
  '文件树.md': '可见文件目录及用途导航', 'module.json': '业务模块索引', 'function.json': '模块内功能点索引',
  '功能描述.md': '当前有效功能、业务规则、边界与主要流程', '功能演变历史.md': '已验收变化、当时问题与必要取舍',
  'component.puml': '组件图 PlantUML 源文件', 'component.svg': '面向人的组件图 SVG 渲染产物',
  'docs/workflows/README.md': '任务名称、阶段、状态与创建时间总索引',
  '.gitignore': 'Git 忽略规则；仅允许忽略 Harness 运行态目录',
  'code-reviewer.md': '独立代码评审 Agent 的职责与输出约束',
  '模块说明.md': '工程模块的定位、组成、流程、边界与事实依据',
  '功能描述.md': '业务功能当前行为、规则、边界、流程与事实依据',
  '功能演变历史.md': '业务功能已验收变化与历史取舍记录',
  'component.puml': '组件图的 PlantUML 可版本化源文件',
  'component.svg': '面向人的组件图 SVG 渲染图',
  'module.json': '业务模块定位索引',
  'function.json': '模块内业务功能点定位索引'
};
let temporarySequence = 0;

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

function parseTreeDescriptions(text) {
  const descriptions = new Map();
  const parents = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^(\s*)- `([^`]+)` — (.+)$/);
    if (!match) continue;
    const depth = match[1].length / 2;
    const name = match[2].replace(/\/$/, '');
    parents[depth] = name;
    parents.length = depth + 1;
    descriptions.set(parents.join('/'), match[3]);
  }
  return descriptions;
}

function generatedPurpose(path, entry, isDirectory = false) {
  if (PURPOSES[path]) return PURPOSES[path];
  if (PURPOSES[entry]) return PURPOSES[entry];
  if (path.startsWith('.codebuddy/rules/')) return '按操作装配的项目执行规约';
  if (path.startsWith('.codebuddy/agents/')) return '项目内独立 Agent 定义与最小权限';
  if (path.startsWith('docs/function/')) {
    if (isDirectory) return '业务模块与功能点的分层知识目录';
    if (path.endsWith('function.json')) return '模块内业务功能点定位索引';
    if (path.endsWith('功能描述.md')) return '业务功能当前行为、规则、边界、流程与事实依据';
    if (path.endsWith('功能演变历史.md')) return '业务功能已验收变化与历史取舍记录';
  }
  if (path.startsWith('docs/knowledge/modules/')) return '工程模块的定位、组成、流程、边界与事实依据';
  if (path.startsWith('docs/knowledge/architecture/')) return path.endsWith('.svg') ? '面向人的组件图 SVG 渲染图' : '组件图的 PlantUML 可版本化源文件';
  if (path.startsWith('docs/workflows/')) {
    if (isDirectory) return '单轮需求到合并的完整工作流产物目录';
    const workflowPurposes = {
      'source-materials.md': '本轮原始材料位置与使用说明', 'candidate-review.md': '候选需求与历史对齐评审', 'requirement.md': '本轮正式需求与业务验收标准',
      'design-alignment.md': '需求到设计的范围、架构和决策记录', 'design-decision.md': '已确认的实现边界、覆盖与取舍', 'development-contract.md': '所有开发任务共同读取的可执行契约', 'task-package.md': '可独立交付的开发任务及验收条件',
      'development-summary.md': '实现、测试与门禁结果摘要', 'knowledge-update-review.md': '长期知识与 Rules 更新审核记录', 'merge-report.md': '需求覆盖、评审与合并结论'
    };
    return workflowPurposes[entry] ?? '工作流任务导航记录';
  }
  return `项目材料入口（由全量扫描登记，读取该路径获取事实）`;
}

async function buildFileTreeMarkdown(projectRoot, suppliedDescriptions = null, { skeleton = false, exclude = [] } = {}) {
  const root = resolve(projectRoot);
  const treePath = join(root, 'docs', 'knowledge', '文件树.md');
  const lines = ['# 文件树', '', skeleton ? '初始化分工骨架：先枚举全量可见路径，再由负责 Agent 回写真实用途。' : '全量项目导航：每项保留一个路径和一句基于实际阅读的用途说明；由初始化与结构变化时刷新。', ''];
  const excluded = new Set(exclude.map((path) => String(path).replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/$/, '')));
  let descriptions = new Map();
  if (suppliedDescriptions) descriptions = new Map(Object.entries(suppliedDescriptions));
  else {
    try { descriptions = parseTreeDescriptions(await readFile(treePath, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  async function walk(directory, prefix = '', depth = 0) {
    const entries = (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (['.git', 'node_modules'].includes(entry.name)) continue;
      const path = prefix + entry.name;
      if (path === '.codebuddy/workflows') continue;
      if ([...excluded].some((prefixPath) => path === prefixPath || path.startsWith(`${prefixPath}/`))) continue;
      const isLink = entry.isSymbolicLink();
      const displayPath = `${entry.name}${entry.isDirectory() && !isLink ? '/' : ''}`;
      if (skeleton) lines.push(`${'  '.repeat(depth)}- \`${displayPath}\``);
      else {
        const description = descriptions.get(path) ?? descriptions.get(`${path}/`) ?? (isLink ? '符号链接（仅展示，不递归）' : generatedPurpose(path, entry.name, entry.isDirectory()));
        if (!description || /(?:用途待确认|用途待项目管理员确认|源码目录|业务逻辑|配置文件|目录用途)/.test(description)) throw new Error(`missing concrete file-tree purpose for ${path}`);
        lines.push(`${'  '.repeat(depth)}- \`${displayPath}\` — ${description}`);
      }
      if (entry.isDirectory() && !isLink) await walk(join(directory, entry.name), `${path}/`, depth + 1);
    }
  }
  await walk(root);
  return `${lines.join('\n')}\n`;
}

export async function previewFileTree(projectRoot) {
  return buildFileTreeMarkdown(projectRoot, null, { skeleton: true });
}

export async function refreshFileTree(projectRoot, suppliedDescriptions = null, options = {}) {
  const root = resolve(projectRoot);
  const treePath = join(root, 'docs', 'knowledge', '文件树.md');
  await atomicText(treePath, await buildFileTreeMarkdown(root, suppliedDescriptions, options));
}

function workflowId(value) {
  if (typeof value !== 'string' || !/^wf-\d{8}-[a-z0-9]{6}$/.test(value)) throw new Error('invalid workflow id');
  return value;
}
function tableValue(value) { return String(value).replace(/[\r\n|]/g, ' ').trim(); }
function linkLabel(value) { return tableValue(value).replaceAll('\\', '\\\\').replaceAll('[', '\\[').replaceAll(']', '\\]'); }
function assertWithin(root, path) { if (path !== root && !path.startsWith(`${root}${sep}`)) throw new Error('workflow navigation path escapes project root'); }

export async function refreshWorkflowNavigation(projectRoot, state) {
  const root = resolve(projectRoot); const taskId = workflowId(state?.task_id);
  for (const key of ['title', 'stage', 'status', 'created_at']) if (typeof state[key] !== 'string' || !state[key].trim()) throw new Error(`invalid workflow navigation field: ${key}`);
  const index = join(root, 'docs', 'workflows', 'README.md');
  const readme = join(root, 'docs', 'workflows', taskId, 'README.md');
  assertWithin(root, index); assertWithin(root, readme);
  const [originalIndex, originalReadme] = await Promise.all([readFile(index, 'utf8'), readFile(readme, 'utf8')]);
  if (!/^# 工作流索引\r?\n/m.test(originalIndex) ||
      !/^\| 任务 \| 阶段 \| 状态 \| 创建时间 \|\r?$/m.test(originalIndex) ||
      !/^\| --- \| --- \| --- \| --- \|\r?$/m.test(originalIndex)) throw new Error('invalid workflow navigation index');
  if (!/^- 任务 ID：.*$/m.test(originalReadme) || !/^- 标题：.*$/m.test(originalReadme) || !/^- 当前\/最终状态：.*$/m.test(originalReadme)) throw new Error('invalid workflow README');

  const escapedTaskId = taskId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rowPattern = new RegExp(`^\\| \\[.*?\\]\\(${escapedTaskId}\\/README\\.md\\) \\|.*$`);
  const indexLines = originalIndex.split(/\r?\n/).filter((line) => !rowPattern.test(line) && !line.includes('<workflow-title>'));
  while (indexLines.at(-1) === '') indexLines.pop();
  indexLines.push(`| [${linkLabel(state.title)}](${taskId}/README.md) | ${tableValue(state.stage)} | ${tableValue(state.status)} | ${tableValue(state.created_at)} |`);
  const nextIndex = `${indexLines.join('\n')}\n`;
  const nextReadme = originalReadme
    .replace(/^- 任务 ID：.*$/m, `- 任务 ID：${taskId}`)
    .replace(/^- 标题：.*$/m, `- 标题：${tableValue(state.title)}`)
    .replace(/^- 当前\/最终状态：.*$/m, `- 当前/最终状态：${tableValue(state.status)}`);
  let indexCommitted = false;
  let readmeCommitted = false;
  try {
    await atomicText(index, nextIndex); indexCommitted = true;
    await atomicText(readme, nextReadme); readmeCommitted = true;
  } catch (error) {
    if (indexCommitted) await atomicText(index, originalIndex).catch(() => {});
    if (readmeCommitted) await atomicText(readme, originalReadme).catch(() => {});
    throw error;
  }
}
