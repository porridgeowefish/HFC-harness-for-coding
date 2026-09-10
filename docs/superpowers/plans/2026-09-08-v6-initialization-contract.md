# V6 Initialization Contract Implementation Plan

> **历史执行计划（非现行）**：V6 已完成并由 0.7.0 计划取代。本文未勾选步骤、旧字段和旧编排均不得作为当前实现要求；当前只执行 `2026-09-09-v07-distributed-initialization-and-markdown-contract.md`。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make first-time initialization produce the complete, human-readable long-term knowledge system in file-tree-first order and guide checklist completion through the natural-language Skill.

**Architecture:** `onboarding.mjs` becomes the single initialization transaction: it writes a generated file tree first, validates a complete knowledge draft against that tree, writes all long-term assets, and produces a fallback SVG from the same component model. The top Skill is the user-facing wizard; CLI remains its controlled persistence boundary. Package/doctor validation reject undocumented generated assets.

**Tech Stack:** Node.js ESM, `node:test`, Markdown/JSON, SVG XML.

**Spec:** `docs/superpowers/specs/2026-09-08-v6-initialization-contract.md`

## Global Constraints

- Do not create a workflow during initialization; workflow remains the only on-demand document family.
- Read and document in the exact file-tree-first sequence in the spec.
- Do not generate placeholders in a completed initialization, undocumented Markdown, digest/hash/CAS, or initialization locks.
- Preserve existing project files and fail before partial writes on conflicts or incomplete facts.
- Use only `apply_patch` for source/document edits; run tests first for each behavior.

---

### Task 1: Make the file tree the authoritative initialization index

**Files:**
- Modify: `plugins/coding-harness/runtime/navigation.mjs`
- Modify: `plugins/coding-harness/runtime/onboarding.mjs`
- Modify: `plugins/coding-harness/tests/canonical-init-knowledge.test.mjs`

**Interfaces:**
- Produces `buildFileTreeDraft(projectRoot): { paths: string[], markdown: string }` before detailed knowledge generation.
- `validateKnowledgeDraft(draft, fileTreePaths)` rejects descriptions and source references outside the generated tree.

- [ ] **Step 1: Write failing tests** asserting a draft is rejected when it describes an absent path and that applied initialization creates the complete Markdown tree before writing summary documents.
- [ ] **Step 2: Run** `node --test plugins/coding-harness/tests/canonical-init-knowledge.test.mjs` and confirm the new assertions fail because the tree is not yet the draft authority.
- [ ] **Step 3: Implement** the tree-first builder and strict path validation; preserve tree syntax and add/replace only one-line purpose comments.
- [ ] **Step 4: Run** the focused test and confirm it passes.

### Task 2: Complete all non-workflow knowledge, functions and SVG

**Files:**
- Modify: `plugins/coding-harness/runtime/onboarding.mjs`
- Modify: `plugins/coding-harness/runtime/navigation.mjs`
- Modify: `plugins/coding-harness/templates/project/docs/knowledge/architecture/component.svg`
- Modify: `plugins/coding-harness/tests/canonical-init-knowledge.test.mjs`

**Interfaces:**
- Produces actual overview, business entry, engineering modules, functions, Rules, PlantUML and SVG from one validated draft.
- Produces `renderComponentSvg(plantUml: string): string` without requiring a globally installed PlantUML executable.

- [ ] **Step 1: Write failing tests** for no placeholders after completed initialization, every discovered business feature having both documents, and a valid readable SVG containing the diagram title/nodes.
- [ ] **Step 2: Run** the focused test and confirm the SVG assertion fails with the current empty template SVG.
- [ ] **Step 3: Implement** the deterministic SVG renderer and transactional writes for all long-term assets; an incomplete draft must refuse apply rather than create a completed-looking skeleton.
- [ ] **Step 4: Run** the focused test and confirm it passes.

### Task 3: Make the top Skill complete checklist confirmations

**Files:**
- Modify: `plugins/coding-harness/skills/harness-orchestrator/SKILL.md`
- Modify: `plugins/coding-harness/bin/harness.mjs`
- Modify: `plugins/coding-harness/commands/init.md`
- Modify: `plugins/coding-harness/tests/canonical-onboarding.test.mjs`

**Interfaces:**
- CLI exposes `checklist-status` and existing `checklist-confirm <id> <actor>`; no arbitrary JSON edit route is added.
- Skill mandates the user-visible eight-item confirmation dialogue and invokes the CLI only after each answer.

- [ ] **Step 1: Write failing tests** for checklist status output and rejection of an apply attempt with incomplete knowledge/checklist facts.
- [ ] **Step 2: Run** `node --test plugins/coding-harness/tests/canonical-onboarding.test.mjs` and confirm failure.
- [ ] **Step 3: Implement** status output, clear Skill wizard copy, and the document order contract in `CODEBUDDY.md` if required by the package contract.
- [ ] **Step 4: Run** the focused test and confirm it passes.

### Task 4: Enforce the generated-document allowlist and refresh contracts

**Files:**
- Modify: `plugins/coding-harness/runtime/contract.mjs`
- Modify: `plugins/coding-harness/runtime/doctor.mjs`
- Modify: `plugins/coding-harness/scripts/validate-package.mjs`
- Modify: `plugins/coding-harness/tests/canonical-contract.test.mjs`
- Modify: `plugins/coding-harness/tests/canonical-release.test.mjs`
- Modify: `技术设计-流程模块与交接协议.md`
- Modify: `ADR-latest.md`
- Modify: `docs/目录与模板二次核查报告.md`

**Interfaces:**
- `ALLOWED_INITIALIZATION_DOCUMENTS` is the exact documented non-workflow set; doctor reports unexpected generated names.

- [ ] **Step 1: Write failing tests** creating `docs/knowledge/gates.md` and `docs/knowledge/harness-self.md`, expecting doctor/validator failure while canonical asset set passes.
- [ ] **Step 2: Run** relevant contract/release tests and confirm the unexpected-file assertion fails.
- [ ] **Step 3: Implement** exact allowlist validation and synchronize the three source documents with the file-tree-first/full-initialization contract.
- [ ] **Step 4: Run** focused tests and confirm they pass.

### Task 5: Full regression and delivery evidence

**Files:**
- Modify: `docs/目录与模板二次核查报告.md`
- Create: `dist/ai-market-0.6.0.zip`

- [ ] **Step 1: Run** `npm test --prefix plugins/coding-harness` and require zero failures.
- [ ] **Step 2: Run** `npm run validate --prefix plugins/coding-harness` and require zero violations.
- [ ] **Step 3: Package** the verified marketplace bundle without deleting prior distributions.
- [ ] **Step 4: Record** exact command evidence, documented deferred minor issues, and the absence/presence of external live-CodeBuddy integration in the report.
