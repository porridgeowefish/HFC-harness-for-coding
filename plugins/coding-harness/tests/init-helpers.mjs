import { confirmChecklistItem, initializeProject } from '../runtime/onboarding.mjs';
import { CHECKLIST_IDS } from '../runtime/contract.mjs';

export async function initializeConfirmed(root, draft) {
  await initializeProject(root, { phase: 'prepare' });
  for (const id of CHECKLIST_IDS) await confirmChecklistItem(root, { id, actor: 'owner', at: '2026-09-10T00:00:00.000Z' });
  return initializeProject(root, { phase: 'finalize', knowledgeDraft: draft });
}

export async function prepareAndConfirm(root) {
  const prepared = await initializeProject(root, { phase: 'prepare' });
  for (const id of CHECKLIST_IDS) await confirmChecklistItem(root, { id, actor: 'owner', at: '2026-09-10T00:00:00.000Z' });
  return prepared;
}
