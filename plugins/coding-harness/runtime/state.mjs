import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { access, mkdir, open, readFile, readdir, rename, rm, unlink, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { WORKFLOW_ARTIFACTS, rulesForOperation } from './contract.mjs';
import { doctorProject } from './doctor.mjs';
import { refreshWorkflowNavigation, refreshFileTree } from './navigation.mjs';
import { runGateProfile } from './gates.mjs';
import { scanProjectMaterials } from './onboarding.mjs';
import { validateCompletedDocument, validateTaskContractReferences } from './markdown-contract.mjs';

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const templateRoot = join(pluginRoot, 'templates', 'workflow');
const STAGES = ['requirement', 'design', 'development', 'review', 'knowledge_review', 'completed'];
const STATUS = new Set(['pending', 'running', 'waiting_human', 'blocked', 'completed', 'failed']);
const PHASE = Object.freeze({
  requirement: { step: 'source_materials', status: 'waiting_human', summary: 'awaiting raw requirement material', next_action: 'record_source_materials' },
  design: { step: 'explore_project', status: 'running', summary: 'design alignment is active', next_action: 'record_task_package_approval' },
  development: { step: 'implement_tasks', status: 'running', summary: 'development and executable gates are active', next_action: 'run_development_gates' },
  review: { step: 'code_review', status: 'running', summary: 'independent review is active', next_action: 'run_independent_review' },
  knowledge_review: { step: 'knowledge_update_review', status: 'running', summary: 'knowledge update review is active', next_action: 'record_knowledge_review' },
  completed: { step: 'done', status: 'completed', summary: 'workflow is completed', next_action: 'none' }
});
const ACTIONS = new Set(['record_source_materials', 'record_candidate_review', 'record_approval', 'record_gate', 'record_mr', 'record_review', 'record_knowledge_review', 'record_merge_report', 'advance', 'rollback', 'record_blocker']);
const ACTION_KEYS = Object.freeze({
  record_source_materials: new Set(['expectedRevision', 'action', 'materials']),
  record_candidate_review: new Set(['expectedRevision', 'action']),
  record_approval: new Set(['expectedRevision', 'action', 'approval']),
  record_gate: new Set(['expectedRevision', 'action', 'name', 'profile']),
  record_mr: new Set(['expectedRevision', 'action', 'headCommit', 'status']),
  record_review: new Set(['expectedRevision', 'action', 'verdict', 'evidence']),
  record_knowledge_review: new Set(['expectedRevision', 'action', 'items', 'by', 'at']),
  record_merge_report: new Set(['expectedRevision', 'action', 'by', 'at']),
  advance: new Set(['expectedRevision', 'action']),
  rollback: new Set(['expectedRevision', 'action', 'target']),
  record_blocker: new Set(['expectedRevision', 'action', 'reason'])
});
const locks = new Map();
const execFileAsync = promisify(execFile);

async function exists(path) { try { await access(path, constants.F_OK); return true; } catch { return false; } }
function tableCell(value) { return String(value).replace(/[\r\n|]/g, ' ').trim(); }
function materialClass(value) {
  return ({ readable_text: '可读文本', binary_or_non_text: '二进制或非文本', unreadable: '不可读取', symbolic_link: '符号链接（未跟随）' })[value] ?? '未知';
}
function normaliseSourceMaterials(materials) {
  if (materials === undefined) return [];
  if (!Array.isArray(materials) || materials.length > 20) throw new Error('materials must be an array with at most 20 entries');
  return materials.map((raw, index) => {
    const value = typeof raw === 'string' ? { kind: 'user_quote', content: raw, provider: 'user' } : raw;
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some((key) => !['kind', 'content', 'provider'].includes(key)) || !['user_quote', 'link', 'path'].includes(value.kind) || typeof value.content !== 'string' || !value.content.trim() || value.content.length > 4000 || (value.provider !== undefined && (typeof value.provider !== 'string' || !value.provider.trim()))) throw new Error(`invalid source material at index ${index}`);
    const content = value.content.trim().replaceAll('\\', '/');
    if (value.kind === 'link' && !/^(?:https?:|mailto:)/i.test(content)) throw new Error(`source material link must be an absolute URL at index ${index}`);
    if (value.kind === 'path' && (content.startsWith('/') || /^[A-Za-z]:\//.test(content) || content.split('/').includes('..'))) throw new Error(`source material path must stay inside the project at index ${index}`);
    return { kind: value.kind, content, provider: value.provider?.trim() || 'user' };
  });
}

async function renderSourceMaterials(root, taskId, now, materials = []) {
  const files = await scanProjectMaterials(root, { exclude: ['.codebuddy/workflows'] });
  const rows = files.map((file, index) => `| source-${String(index + 1).padStart(4, '0')} | 项目文件 | ${tableCell(file.path)} | 项目工作区 | 全量扫描发现；${materialClass(file.classification)}，按流程决定是否作为本轮事实读取 |`);
  const suppliedRows = normaliseSourceMaterials(materials).map((material, index) => {
    const type = ({ user_quote: '用户原话', link: '外部链接', path: '项目路径' })[material.kind];
    return `| call-${String(index + 1).padStart(4, '0')} | ${type} | ${tableCell(material.content)} | ${tableCell(material.provider)} | 本轮调用提供的原始材料定位；候选评审前不得扩写为正式需求 |`;
  });
  return [
    '# 原始材料索引', '',
    `- 任务 ID：${taskId}`,
    `- 创建时间：${now}`,
    '- 扫描范围：项目内每个可见常规文件；不按 README、docs 或固定扩展名预设材料位置。仅排除 Git、依赖目录和 Harness workflow 运行态。',
    '- 用户本轮原话、链接或外部材料：由编排入口在本表追加定位项；不复制材料正文。', '',
    '| 编号 | 来源类型 | 位置 | 提供人/系统 | 使用说明 |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
    ...suppliedRows
  ].join('\n') + '\n';
}

async function appendSourceMaterials(root, state, materials) {
  const supplied = normaliseSourceMaterials(materials);
  if (!supplied.length) return;
  const path = join(root, ...workflowPath(state.task_id, 'source-materials.md').split('/'));
  const original = await readFile(path, 'utf8');
  if (!/^# 原始材料索引\r?\n/.test(original) || !/^\| 编号 \| 来源类型 \| 位置 \| 提供人\/系统 \| 使用说明 \|\r?$/m.test(original)) throw new Error('source-materials.md has an invalid canonical structure');
  const rows = supplied.map((material, index) => {
    const type = ({ user_quote: '用户原话', link: '外部链接', path: '项目路径' })[material.kind];
    return `| call-${state.revision + 1}-${String(index + 1).padStart(2, '0')} | ${type} | ${tableCell(material.content)} | ${tableCell(material.provider)} | 本轮调用提供的原始材料定位；候选评审前不得扩写为正式需求 |`;
  });
  await writeFile(path, `${original.trimEnd()}\n${rows.join('\n')}\n`);
}

async function requireCompletedArtifact(root, state, artifact, action) {
  const path = workflowPath(state.task_id, artifact);
  try {
    const text = await readFile(join(root, ...path.split('/')), 'utf8');
    const errors = validateCompletedDocument(path, text);
    if (errors.length) throw new Error(errors.join('; '));
  } catch (error) {
    throw new Error(`${artifact} must be completed before ${action}: ${error.message}`);
  }
}

async function requireArtifactsForAction(root, state, action, approvalKey = null) {
  const required = [];
  const requirementArtifacts = ['source-materials.md', 'candidate-review.md', 'requirement.md'];
  const designArtifacts = [...requirementArtifacts, 'design-alignment.md', 'design-decision.md', 'development-contract.md', 'task-package.md'];
  const developmentArtifacts = [...designArtifacts, 'development-summary.md'];
  if (action === 'record_source_materials') required.push('source-materials.md');
  if (action === 'record_candidate_review') required.push('source-materials.md', 'candidate-review.md');
  if (action === 'record_approval') {
    if (approvalKey === 'requirement_published') required.push(...requirementArtifacts);
    if (approvalKey === 'task_package') required.push(...designArtifacts);
    if (approvalKey === 'development_summary') required.push(...developmentArtifacts);
    if (approvalKey === 'knowledge_update_review') required.push(...developmentArtifacts, 'knowledge-update-review.md');
  }
  if (action === 'record_knowledge_review') required.push(...developmentArtifacts, 'knowledge-update-review.md');
  if (action === 'record_merge_report') required.push(...developmentArtifacts, 'knowledge-update-review.md', 'merge-report.md');
  if (action === 'advance') {
    if (state.stage === 'requirement') required.push(...requirementArtifacts);
    if (state.stage === 'design') required.push(...designArtifacts);
    if (state.stage === 'development') required.push(...developmentArtifacts);
    if (state.stage === 'review') required.push(...developmentArtifacts);
    if (state.stage === 'knowledge_review') required.push(...developmentArtifacts, 'knowledge-update-review.md', 'merge-report.md');
  }
  if (action === 'record_review') required.push(...developmentArtifacts);
  for (const artifact of required) await requireCompletedArtifact(root, state, artifact, action);
}

async function requireTaskContractReferences(root, state) {
  const directory = join(root, 'docs', 'workflows', state.task_id);
  const contractText = await readFile(join(directory, 'development-contract.md'), 'utf8');
  const packageText = await readFile(join(directory, 'task-package.md'), 'utf8');
  const errors = validateTaskContractReferences(contractText, packageText);
  if (errors.length) throw new Error(errors.join('; '));
}

const APPROVED_DESIGN_ARTIFACTS = ['design-decision.md', 'development-contract.md', 'task-package.md'];
async function git(root, args) {
  try {
    const result = await execFileAsync('git', ['-C', root, '-c', 'core.quotepath=false', ...args], { windowsHide: true, encoding: 'utf8' });
    return { code: 0, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
  } catch (error) {
    return { code: Number.isInteger(error.code) ? error.code : -1, stdout: String(error.stdout ?? '').trim(), stderr: String(error.stderr ?? error.message).trim() };
  }
}
function approvedDesignPaths(state) { return APPROVED_DESIGN_ARTIFACTS.map((file) => workflowPath(state.task_id, file)); }
async function captureApprovedDesignCommit(root, state) {
  const paths = approvedDesignPaths(state);
  const repository = await git(root, ['rev-parse', '--show-toplevel']);
  if (repository.code !== 0) throw new Error('Git repository is required before task-package approval');
  const tracked = await git(root, ['ls-files', '--cached', '--', ...paths]);
  const trackedSet = new Set(tracked.stdout.split(/\r?\n/).filter(Boolean).map((path) => path.replaceAll('\\', '/')));
  const missing = paths.filter((path) => !trackedSet.has(path));
  if (missing.length) throw new Error(`approved design artifacts must be tracked by Git: ${missing.join(', ')}`);
  const status = await git(root, ['status', '--porcelain', '--untracked-files=all', '--', ...paths]);
  if (status.code !== 0 || status.stdout) throw new Error('approved design artifacts must be committed and clean in Git');
  const head = await git(root, ['rev-parse', 'HEAD']);
  if (head.code !== 0 || !head.stdout) throw new Error('unable to record approved design Git commit');
  return head.stdout;
}
async function requireApprovedDesignUnchanged(root, state) {
  const commit = state.approvals.task_package?.commit;
  if (!commit) throw new Error('task-package approval must record a Git commit');
  const diff = await git(root, ['diff', '--quiet', commit, '--', ...approvedDesignPaths(state)]);
  if (diff.code === 1) throw new Error('design artifacts changed since task-package approval');
  if (diff.code !== 0) throw new Error(`unable to verify approved design artifacts: ${diff.stderr}`);
}
function time(value) { return typeof value === 'string' && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value; }
function workflowPath(id, file) { return `docs/workflows/${id}/${file}`; }
function assertId(id) { if (!/^wf-\d{8}-[a-z0-9]{6}$/.test(id)) throw new Error('invalid workflow id'); }
function exactObject(value, keys) { return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every((key) => keys.has(key)); }
function gateResultOk(result) {
  if (!exactObject(result, new Set(['schemaVersion', 'profile', 'ok', 'status', 'reason', 'checks', 'finishedAt'])) || result.schemaVersion !== '1.0' || !['preCommit', 'ci'].includes(result.profile) || typeof result.ok !== 'boolean' || !['unconfigured', 'passed', 'failed'].includes(result.status) || !time(result.finishedAt) || !Array.isArray(result.checks)) return false;
  if ((result.status === 'unconfigured') !== (result.checks.length === 0) || (result.status === 'unconfigured' && typeof result.reason !== 'string')) return false;
  return result.checks.every((check) => exactObject(check, new Set(['id', 'command', 'args', 'declaredCommand', 'cwd', 'required', 'status', 'exitCode', 'durationMs', 'stdout', 'stderr'])) && typeof check.id === 'string' && typeof check.command === 'string' && Array.isArray(check.args) && check.args.every((arg) => typeof arg === 'string') && (check.declaredCommand === undefined || typeof check.declaredCommand === 'string') && typeof check.cwd === 'string' && typeof check.required === 'boolean' && ['passed', 'failed', 'timed_out', 'error'].includes(check.status) && (check.exitCode === null || Number.isInteger(check.exitCode)) && Number.isInteger(check.durationMs) && check.durationMs >= 0 && typeof check.stdout === 'string' && typeof check.stderr === 'string');
}
function evidenceOk(item) {
  const keys = new Set(['id', 'kind', 'producer', 'subject', 'commit', 'location', 'result']);
  if (!exactObject(item, keys) || !['gate_result', 'review_result', 'security_result', 'diff', 'test_result', 'external_link'].includes(item.kind) || !['id', 'producer', 'subject', 'commit', 'location'].every((key) => typeof item[key] === 'string' && item[key])) return false;
  return item.kind === 'gate_result' ? gateResultOk(item.result) : item.result === undefined;
}
function approvalOk(record) { return exactObject(record, new Set(['status', 'by', 'at', 'commit'])) && record.status === 'approved' && typeof record.by === 'string' && record.by && time(record.at) && (record.commit === null || typeof record.commit === 'string'); }
function setPhase(state, stage, step = PHASE[stage].step) { Object.assign(state, PHASE[stage], { stage, step }); }
function setRequirementStep(state, step, summary, nextAction) {
  Object.assign(state, { stage: 'requirement', step, status: 'waiting_human', summary, next_action: nextAction });
}

function validateState(state) {
  const required = ['schema_version', 'revision', 'task_id', 'title', 'operation', 'rules', 'stage', 'step', 'status', 'summary', 'next_action', 'artifacts', 'tasks', 'gates', 'approvals', 'mr', 'review', 'knowledge_review', 'blockers', 'created_at', 'updated_at'];
  if (!state || typeof state !== 'object' || required.some((key) => !(key in state))) throw new Error('invalid workflow state shape');
  if (Object.keys(state).some((key) => !required.includes(key))) throw new Error('unknown workflow state field');
  if (state.schema_version !== '1.0' || !Number.isInteger(state.revision) || !STAGES.includes(state.stage) || !STATUS.has(state.status) || !time(state.created_at) || !time(state.updated_at)) throw new Error('invalid workflow state header');
  assertId(state.task_id);
  if (typeof state.title !== 'string' || !state.title.trim() || JSON.stringify(state.rules) !== JSON.stringify(rulesForOperation(state.operation))) throw new Error('invalid workflow Rules assembly');
  if (!exactObject(state.artifacts, new Set(['evidence_refs', ...WORKFLOW_ARTIFACTS])) || !Array.isArray(state.artifacts.evidence_refs) || state.artifacts.evidence_refs.some((item) => !evidenceOk(item))) throw new Error('invalid evidence references');
  for (const artifact of WORKFLOW_ARTIFACTS) if (state.artifacts[artifact] !== workflowPath(state.task_id, artifact)) throw new Error(`invalid artifact path: ${artifact}`);
  if (!Array.isArray(state.tasks) || state.tasks.length || !Array.isArray(state.blockers) || state.blockers.some((item) => !exactObject(item, new Set(['reason', 'commit'])) || typeof item.reason !== 'string' || (item.commit !== null && typeof item.commit !== 'string'))) throw new Error('invalid workflow tasks or blockers');
  if (!exactObject(state.approvals, new Set(['requirement_published', 'task_package', 'development_summary', 'knowledge_update_review'])) || Object.values(state.approvals).some((record) => !approvalOk(record))) throw new Error('invalid workflow approvals');
  if (!exactObject(state.gates, new Set(['development'])) || (state.gates.development && (!exactObject(state.gates.development, new Set(['status', 'commit', 'evidenceId', 'profile'])) || !['passed', 'failed'].includes(state.gates.development.status) || typeof state.gates.development.commit !== 'string' || typeof state.gates.development.evidenceId !== 'string' || !['preCommit', 'ci'].includes(state.gates.development.profile)))) throw new Error('invalid workflow gates');
  if (!exactObject(state.mr, new Set(['headCommit', 'status', 'merge_report'])) || (state.mr.headCommit !== null && typeof state.mr.headCommit !== 'string') || !['not_created', 'open', 'merged'].includes(state.mr.status) || (state.mr.merge_report && (!exactObject(state.mr.merge_report, new Set(['commit', 'recorded_by', 'recorded_at'])) || typeof state.mr.merge_report.commit !== 'string' || typeof state.mr.merge_report.recorded_by !== 'string' || !time(state.mr.merge_report.recorded_at)))) throw new Error('invalid workflow MR');
  if (!exactObject(state.review, new Set(['verdict', 'reviewedCommit', 'evidenceId', 'repairRounds'])) || ![null, 'pass', 'fail', 'needs_human_judgment'].includes(state.review.verdict) || (state.review.reviewedCommit !== null && typeof state.review.reviewedCommit !== 'string') || (state.review.evidenceId !== null && typeof state.review.evidenceId !== 'string') || !Number.isInteger(state.review.repairRounds) || state.review.repairRounds < 0) throw new Error('invalid workflow review');
  if (!exactObject(state.knowledge_review, new Set(['items', 'approved_by', 'approved_at', 'commit'])) || !Array.isArray(state.knowledge_review.items) || state.knowledge_review.items.some((item) => !exactObject(item, new Set(['asset', 'decision'])) || typeof item.asset !== 'string' || !['需要更新', '无需更新', '待人裁定'].includes(item.decision)) || (state.knowledge_review.approved_by !== null && typeof state.knowledge_review.approved_by !== 'string') || (state.knowledge_review.approved_at !== null && !time(state.knowledge_review.approved_at)) || (state.knowledge_review.commit !== null && typeof state.knowledge_review.commit !== 'string')) throw new Error('invalid workflow knowledge review');
  return state;
}

async function atomicJson(path, value) { const temp = `${path}.${process.pid}.${Date.now()}.${randomBytes(3).toString('hex')}.tmp`; await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`); await rename(temp, path); }
async function snapshotFiles(paths) {
  const snapshots = new Map();
  for (const path of paths) snapshots.set(path, await readFile(path));
  return snapshots;
}
async function restoreSnapshots(snapshots) {
  const failures = [];
  for (const [path, bytes] of snapshots) {
    try {
      await rm(path, { recursive: true, force: true });
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, bytes);
    } catch (error) { failures.push(error); }
  }
  if (failures.length) throw new AggregateError(failures, 'failed to restore workflow transaction');
}
async function readState(root, id) { return validateState(JSON.parse(await readFile(join(root, '.codebuddy', 'workflows', id, 'state.json'), 'utf8'))); }
async function longLivedAssets(root) {
  const assets = [];
  async function visit(path, relativePath) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const nextRelative = `${relativePath}/${entry.name}`;
      if (entry.isDirectory()) await visit(join(path, entry.name), nextRelative);
      else assets.push(nextRelative);
    }
  }
  for (const path of ['docs/knowledge', 'docs/function', '.codebuddy/rules']) await visit(join(root, ...path.split('/')), path);
  return assets.sort();
}

function sameCommit(record, commit) { return record && record.commit === commit; }
function invalidateSnapshotFacts(next, { returnToReview = false } = {}) {
  next.approvals = Object.fromEntries(Object.entries(next.approvals).filter(([key]) => !['development_summary', 'knowledge_update_review'].includes(key)));
  next.gates = Object.fromEntries(Object.entries(next.gates).filter(([key]) => key !== 'development'));
  next.review = { verdict: null, reviewedCommit: null, evidenceId: null, repairRounds: next.review.repairRounds ?? 0 };
  next.knowledge_review = { items: [], approved_by: null, approved_at: null, commit: null };
  delete next.mr.merge_report;
  if (returnToReview) { next.stage = 'review'; next.step = 'code_review'; next.next_action = 'run_independent_review'; }
  else { next.stage = 'development'; next.step = 'implement_tasks'; next.next_action = 'run_development_gates'; }
  next.status = 'running'; next.summary = 'MR snapshot changed; commit-bound evidence was invalidated';
}

function requireApproval(state, key) {
  const record = state.approvals[key];
  if (!record || record.status !== 'approved' || !record.by || !time(record.at)) throw new Error(`${key} approval is required`);
}

async function advance(root, state) {
  if (state.stage === 'requirement') { requireApproval(state, 'requirement_published'); await requireArtifactsForAction(root, state, 'advance'); setPhase(state, 'design'); }
  else if (state.stage === 'design') { requireApproval(state, 'task_package'); await requireArtifactsForAction(root, state, 'advance'); await requireTaskContractReferences(root, state); await requireApprovedDesignUnchanged(root, state); setPhase(state, 'development'); }
  else if (state.stage === 'development') {
    await requireApprovedDesignUnchanged(root, state);
    if (!sameCommit(state.gates.development, state.mr.headCommit) || state.gates.development.status !== 'passed') throw new Error('development gate must pass for current MR commit');
    if (!sameCommit(state.approvals.development_summary, state.mr.headCommit)) throw new Error('development summary approval is required for current MR commit');
    await requireArtifactsForAction(root, state, 'advance');
    setPhase(state, 'review');
  } else if (state.stage === 'review') {
    await requireApprovedDesignUnchanged(root, state);
    if (state.review.verdict !== 'pass' || state.review.reviewedCommit !== state.mr.headCommit) throw new Error('independent review must pass for current MR commit');
    setPhase(state, 'knowledge_review');
  } else if (state.stage === 'knowledge_review') {
    await requireApprovedDesignUnchanged(root, state);
    const review = state.knowledge_review;
    if (!review.items.length || review.items.some((item) => item.decision === '待人裁定') || review.commit !== state.mr.headCommit || !review.approved_by || !time(review.approved_at)) throw new Error('knowledge review requires complete approved classification for current MR commit');
    requireApproval(state, 'knowledge_update_review');
    if (!state.mr.merge_report || state.mr.merge_report.commit !== state.mr.headCommit || state.mr.status !== 'merged') throw new Error('knowledge review approval, current merge report and MR merge are required');
    await requireArtifactsForAction(root, state, 'advance');
    setPhase(state, 'completed');
  } else throw new Error('workflow is already completed');
}

function rollback(state, target) {
  const allowed = { design: ['requirement'], development: ['design'], review: ['development'], knowledge_review: ['review'] };
  if (!allowed[state.stage]?.includes(target)) throw new Error('illegal rollback target');
  if (target === 'requirement') {
    state.approvals = {}; state.gates = {}; state.mr = { headCommit: null, status: 'not_created' }; state.review = { verdict: null, reviewedCommit: null, evidenceId: null, repairRounds: state.review.repairRounds ?? 0 }; state.knowledge_review = { items: [], approved_by: null, approved_at: null, commit: null };
  } else if (target === 'design') {
    delete state.approvals.task_package; delete state.approvals.development_summary; delete state.approvals.knowledge_update_review;
    state.gates = {}; state.mr = { headCommit: null, status: 'not_created' }; state.review = { verdict: null, reviewedCommit: null, evidenceId: null, repairRounds: state.review.repairRounds ?? 0 }; state.knowledge_review = { items: [], approved_by: null, approved_at: null, commit: null };
  } else if (target === 'development') {
    delete state.approvals.development_summary; delete state.approvals.knowledge_update_review;
    state.gates = {}; state.mr = { headCommit: null, status: 'not_created' }; state.review = { verdict: null, reviewedCommit: null, evidenceId: null, repairRounds: state.review.repairRounds ?? 0 }; state.knowledge_review = { items: [], approved_by: null, approved_at: null, commit: null };
  } else if (target === 'review') {
    delete state.approvals.knowledge_update_review; state.knowledge_review = { items: [], approved_by: null, approved_at: null, commit: null };
    delete state.mr.merge_report;
  }
  setPhase(state, target, target === 'design' ? 'design_alignment' : PHASE[target].step);
}

async function applyAction(root, state, request) {
  if (!ACTIONS.has(request.action)) throw new Error('a supported action is required');
  if (Object.keys(request).some((key) => !ACTION_KEYS[request.action].has(key))) throw new Error('unknown action field');
  if (request.action === 'record_source_materials') {
    if (state.stage !== 'requirement' || state.step !== 'source_materials') throw new Error('source materials are not the current workflow action');
    await appendSourceMaterials(root, state, request.materials);
    await requireArtifactsForAction(root, state, request.action);
    setRequirementStep(state, 'candidate_review', 'candidate requirement is awaiting human review', 'record_candidate_review');
  } else if (request.action === 'record_candidate_review') {
    if (state.stage !== 'requirement' || state.step !== 'candidate_review') throw new Error('candidate review is not the current workflow action');
    await requireArtifactsForAction(root, state, request.action);
    setRequirementStep(state, 'publish_requirement', 'published requirement is awaiting human approval', 'record_requirement_approval');
  } else if (request.action === 'record_approval') {
    const approval = request.approval;
    const allowed = state.stage === 'requirement' && state.step === 'publish_requirement' ? ['requirement_published'] : state.stage === 'design' ? ['task_package'] : state.stage === 'development' ? ['development_summary'] : state.stage === 'knowledge_review' ? ['knowledge_update_review'] : [];
    if (!approval || Object.keys(approval).some((key) => !['key', 'by', 'at'].includes(key)) || !allowed.includes(approval.key) || typeof approval.by !== 'string' || !approval.by.trim() || !time(approval.at)) throw new Error('invalid approval action');
    await requireArtifactsForAction(root, state, request.action, approval.key);
    if (approval.key === 'task_package') await requireTaskContractReferences(root, state);
    const commit = approval.key === 'task_package' ? await captureApprovedDesignCommit(root, state) : state.mr.headCommit ?? null;
    const record = { status: 'approved', by: approval.by.trim(), at: approval.at, commit };
    state.approvals[approval.key] = record;
    const next = {
      requirement_published: ['requirement published; awaiting next instruction to enter design', 'advance_to_design'],
      task_package: ['task package approved; awaiting next instruction to enter development', 'advance_to_development'],
      development_summary: ['development summary approved; awaiting next instruction to enter review', 'advance_to_review'],
      knowledge_update_review: ['knowledge review approved; awaiting merge report and merge confirmation', 'record_merge_report']
    }[approval.key];
    Object.assign(state, { status: 'waiting_human', summary: next[0], next_action: next[1] });
  } else if (request.action === 'record_gate') {
    if (state.stage !== 'development' || request.name !== 'development' || !state.mr.headCommit || !['preCommit', 'ci'].includes(request.profile)) throw new Error('invalid development gate action');
    const result = await runGateProfile(root, request.profile);
    const evidence = { id: `EV-gate-${state.revision + 1}-${request.profile}`, kind: 'gate_result', producer: 'gate-runner', subject: `${request.profile} gate profile`, commit: state.mr.headCommit, location: `.codebuddy/workflows/${state.task_id}/state.json`, result };
    state.artifacts.evidence_refs.push(evidence);
    state.gates.development = { status: result.ok ? 'passed' : 'failed', commit: state.mr.headCommit, evidenceId: evidence.id, profile: request.profile };
  } else if (request.action === 'record_mr') {
    const allowedStatuses = state.stage === 'development' || state.stage === 'review' ? ['open'] : state.stage === 'knowledge_review' ? ['open', 'merged'] : [];
    if (typeof request.headCommit !== 'string' || !request.headCommit.trim() || !allowedStatuses.includes(request.status ?? 'open')) throw new Error('invalid MR action');
    const changed = state.mr.headCommit && state.mr.headCommit !== request.headCommit;
    state.mr = { ...state.mr, headCommit: request.headCommit, status: request.status ?? 'open' }; if (changed) invalidateSnapshotFacts(state, { returnToReview: state.stage === 'knowledge_review' });
  } else if (request.action === 'record_review') {
    if (state.stage !== 'review' || !state.mr.headCommit || !request.evidence || !evidenceOk(request.evidence) || request.evidence.kind !== 'review_result' || request.evidence.producer !== 'code-reviewer' || request.evidence.commit !== state.mr.headCommit || !['pass', 'fail', 'needs_human_judgment'].includes(request.verdict)) throw new Error('invalid review action');
    state.artifacts.evidence_refs.push(request.evidence); state.review = { verdict: request.verdict, reviewedCommit: state.mr.headCommit, evidenceId: request.evidence.id, repairRounds: state.review.repairRounds ?? 0 };
  } else if (request.action === 'record_knowledge_review') {
    await requireArtifactsForAction(root, state, request.action);
    const expectedAssets = await longLivedAssets(root);
    const actualAssets = Array.isArray(request.items) ? request.items.map((item) => item?.asset).sort() : [];
    if (state.stage !== 'knowledge_review' || !Array.isArray(request.items) || JSON.stringify(actualAssets) !== JSON.stringify(expectedAssets) || request.items.some((item) => !item || typeof item.asset !== 'string' || !['需要更新', '无需更新', '待人裁定'].includes(item.decision)) || typeof request.by !== 'string' || !time(request.at)) throw new Error('invalid knowledge review action');
    state.knowledge_review = { items: request.items, approved_by: request.by, approved_at: request.at, commit: state.mr.headCommit };
  } else if (request.action === 'record_merge_report') {
    if (state.stage !== 'knowledge_review' || !state.mr.headCommit || typeof request.by !== 'string' || !request.by.trim() || !time(request.at)) throw new Error('invalid merge report action');
    await requireArtifactsForAction(root, state, request.action);
    state.mr.merge_report = { commit: state.mr.headCommit, recorded_by: request.by.trim(), recorded_at: request.at };
  } else if (request.action === 'advance') return advance(root, state);
  else if (request.action === 'rollback') return rollback(state, request.target);
  else if (request.action === 'record_blocker') {
    if (state.stage !== 'review' || typeof request.reason !== 'string' || !request.reason) throw new Error('invalid blocker action');
    const rounds = (state.review.repairRounds ?? 0) + 1; state.review.repairRounds = rounds; state.blockers.push({ reason: request.reason, commit: state.mr.headCommit });
    if (rounds >= 2) { state.status = 'blocked'; state.next_action = 'request_human_decision'; } else rollback(state, 'development');
  }
}

export function createWorkflowId(now = new Date()) { const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'; return `wf-${now.toISOString().slice(0, 10).replaceAll('-', '')}-${Array.from(randomBytes(6), (byte) => alphabet[byte % alphabet.length]).join('')}`; }

export async function createWorkflow(projectRoot, title, { taskId = createWorkflowId(), operation, materials = [] } = {}) {
  const root = resolve(projectRoot); assertId(taskId);
  // A project file may have been added since initialization. Refresh the
  // generated navigation before the structural doctor so the new path enters
  // the same Git-managed knowledge surface that the workflow will snapshot.
  await refreshFileTree(root);
  if (!(await doctorProject(root)).ok) throw new Error('doctor must pass before workflow creation');
  const rules = rulesForOperation(operation); for (const rule of rules) if (!(await exists(join(root, '.codebuddy', 'rules', rule)))) throw new Error(`required Rule is missing: ${rule}`);
  const docsRoot = join(root, 'docs', 'workflows', taskId); const stateRoot = join(root, '.codebuddy', 'workflows', taskId); if (await exists(docsRoot) || await exists(stateRoot)) throw new Error('workflow already exists');
  const indexPath = join(root, 'docs', 'workflows', 'README.md');
  const fileTreePath = join(root, 'docs', 'knowledge', '文件树.md');
  const snapshots = await snapshotFiles([indexPath, fileTreePath]);
  const staging = `${docsRoot}.${process.pid}.${randomBytes(3).toString('hex')}.tmp`; const now = new Date().toISOString();
  // Scan before the staging directory exists: historical human workflow files
  // remain visible material, while this new workflow cannot index itself.
  const sourceMaterials = await renderSourceMaterials(root, taskId, now, materials);
  try {
    await mkdir(staging, { recursive: true }); const artifacts = { evidence_refs: [] };
    for (const artifact of WORKFLOW_ARTIFACTS) {
      const content = artifact === 'source-materials.md'
        ? sourceMaterials
        : await readFile(join(templateRoot, artifact), 'utf8');
      await writeFile(join(staging, artifact), content);
      artifacts[artifact] = workflowPath(taskId, artifact);
    }
    const state = validateState({ schema_version: '1.0', revision: 0, task_id: taskId, title, operation, rules, stage: 'requirement', ...PHASE.requirement, artifacts, tasks: [], gates: {}, approvals: {}, mr: { headCommit: null, status: 'not_created' }, review: { verdict: null, reviewedCommit: null, evidenceId: null, repairRounds: 0 }, knowledge_review: { items: [], approved_by: null, approved_at: null, commit: null }, blockers: [], created_at: now, updated_at: now });
    await rename(staging, docsRoot); await mkdir(stateRoot, { recursive: true }); await atomicJson(join(stateRoot, 'state.json'), state); await refreshFileTree(root); await refreshWorkflowNavigation(root, state); return state;
  } catch (error) {
    await rm(staging, { recursive: true, force: true }); await rm(docsRoot, { recursive: true, force: true }); await rm(stateRoot, { recursive: true, force: true });
    try { await restoreSnapshots(snapshots); } catch (restoreError) { throw new AggregateError([error, restoreError], 'workflow creation failed and compensation was incomplete'); }
    throw error;
  }
}

async function withLock(id, fn) {
  const previous = locks.get(id) ?? Promise.resolve();
  let release;
  const baton = new Promise((resolvePromise) => { release = resolvePromise; });
  const queued = previous.then(() => baton);
  locks.set(id, queued);
  await previous;
  try { return await fn(); }
  finally { release(); if (locks.get(id) === queued) locks.delete(id); }
}

async function withFileLock(path, fn) {
  const lock = `${path}.lock`;
  let handle;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try { handle = await open(lock, 'wx'); break; }
    catch (error) { if (error.code !== 'EEXIST') throw error; await new Promise((resolvePromise) => setTimeout(resolvePromise, 10)); }
  }
  if (!handle) throw new Error('workflow is busy');
  try { return await fn(); } finally { await handle.close(); await unlink(lock).catch(() => {}); }
}

export async function transitionWorkflow(projectRoot, taskId, request) {
  const root = resolve(projectRoot); assertId(taskId);
  const statePath = join(root, '.codebuddy', 'workflows', taskId, 'state.json');
  return withLock(`${root}:${taskId}`, () => withFileLock(statePath, async () => {
    const indexPath = join(root, 'docs', 'workflows', 'README.md');
    const readmePath = join(root, 'docs', 'workflows', taskId, 'README.md');
    const snapshotPaths = [statePath, indexPath, readmePath];
    if (request.action === 'record_source_materials') snapshotPaths.push(join(root, ...workflowPath(taskId, 'source-materials.md').split('/')));
    const snapshots = await snapshotFiles(snapshotPaths);
    try {
      const state = validateState(JSON.parse(snapshots.get(statePath).toString('utf8'))); if (request.expectedRevision !== state.revision) throw new Error('stale revision');
      const next = structuredClone(state); await applyAction(root, next, request); next.revision += 1; next.updated_at = new Date().toISOString(); validateState(next); await atomicJson(statePath, next); await refreshWorkflowNavigation(root, next); return next;
    } catch (error) {
      try { await restoreSnapshots(snapshots); } catch (restoreError) { throw new AggregateError([error, restoreError], 'workflow transition failed and compensation was incomplete'); }
      throw error;
    }
  }));
}
