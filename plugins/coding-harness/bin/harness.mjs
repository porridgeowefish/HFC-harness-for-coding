#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { checklistStatus, confirmChecklistItem, initializeProject } from '../runtime/onboarding.mjs';
import { doctorProject } from '../runtime/doctor.mjs';
import { createWorkflow, transitionWorkflow } from '../runtime/state.mjs';
import { createBusinessFeature, createEngineeringModule } from '../runtime/knowledge.mjs';

const [command, ...args] = process.argv.slice(2);
const project = resolve(process.cwd());

async function optionalJsonArgument(flag) {
  const index = args.indexOf(flag);
  if (index < 0) return null;
  const path = args[index + 1];
  if (!path) throw new Error(`${flag} requires a JSON file path`);
  return JSON.parse(await readFile(resolve(path), 'utf8'));
}

if (command === 'knowledge-feature') {
  console.log(JSON.stringify(await createBusinessFeature(project, args[0], args[1], await optionalJsonArgument('--facts')), null, 2));
} else if (command === 'knowledge-module') {
  console.log(JSON.stringify(await createEngineeringModule(project, args[0], await optionalJsonArgument('--facts')), null, 2));
} else if (command === 'init') {
  const knowledgeIndex = args.indexOf('--knowledge');
  const knowledgeDraft = knowledgeIndex >= 0 ? args[knowledgeIndex + 1] : null;
  const phaseIndex = args.indexOf('--phase');
  const phase = phaseIndex >= 0 ? args[phaseIndex + 1] : null;
  if (phase !== null && !['prepare', 'finalize'].includes(phase)) throw new Error('--phase must be prepare or finalize');
  console.log(JSON.stringify(await initializeProject(project, { apply: args.includes('--apply'), knowledgeDraft, phase }), null, 2));
} else if (command === 'checklist-confirm') {
  const [id, actor] = args;
  console.log(JSON.stringify(await confirmChecklistItem(project, { id, actor }), null, 2));
} else if (command === 'checklist-status') {
  console.log(JSON.stringify(await checklistStatus(project), null, 2));
} else if (command === 'doctor') {
  const report = await doctorProject(project); console.log(JSON.stringify(report, null, 2)); process.exitCode = report.ok ? 0 : 1;
} else if (command === 'start') {
  const [operation, ...rest] = args;
  const materialIndex = rest.indexOf('--material');
  const material = materialIndex >= 0 ? rest.slice(materialIndex + 1).join(' ').trim() : '';
  const titleParts = materialIndex >= 0 ? rest.slice(0, materialIndex) : rest;
  const title = titleParts.join(' ').trim();
  if (!title) throw new Error('workflow title is required');
  console.log(JSON.stringify(await createWorkflow(project, title, { operation, materials: material ? [{ kind: 'user_quote', content: material, provider: 'user' }] : [] }), null, 2));
} else if (command === 'transition') {
  const [taskId, requestJson] = args;
  if (!taskId || !requestJson) throw new Error('workflow id and transition request JSON are required');
  console.log(JSON.stringify(await transitionWorkflow(project, taskId, JSON.parse(requestJson)), null, 2));
} else {
  throw new Error('usage: harness <init [--phase prepare|finalize] [--apply --knowledge <draft.json>]|checklist-status|checklist-confirm <id> <actor>|doctor|start <operation> <title>|transition <workflow-id> <request-json>|knowledge-feature <module> <feature> --facts <facts.json>|knowledge-module <module> --facts <facts.json>');
}
