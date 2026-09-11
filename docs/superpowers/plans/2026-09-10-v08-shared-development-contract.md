# Coding Harness 0.8.0 Shared Development Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Release Coding Harness 0.8.0 with one first-class `development-contract.md` shared by every development task.

**Architecture:** Add the artifact to the canonical workflow between design decision and task package. Keep one generated document while supplying five strictly validated contract-block templates, and enforce the new artifact at approval and development transitions.

**Tech Stack:** Node.js 20 ESM, Node test runner, Markdown contract parser, Python ZIP builder, Git.

**Spec:** `docs/superpowers/specs/2026-09-10-v08-shared-development-contract.md`

## Global Constraints

- Git remains the only shared version and history mechanism.
- Do not add digest, content hash, CAS or an initialization lock.
- Dynamic template facts use only declared `<...>` placeholders.
- Generated workflow documents remain under `docs/workflows/<workflow-id>/`.
- Irrelevant contract blocks are omitted rather than filled with generic prose.

---

### Task 1: Canonical artifact and templates

**Files:**
- Create: `plugins/coding-harness/templates/workflow/development-contract.md`
- Create: `plugins/coding-harness/templates/contracts/{http-api,public-interface,data,cross-task-integration,shared-behavior}.md`
- Modify: `plugins/coding-harness/templates/workflow/{README,design-decision,task-package}.md`
- Modify: `plugins/coding-harness/runtime/{contract,markdown-contract,template-lint}.mjs`
- Test: `plugins/coding-harness/tests/{canonical-contract,canonical-layout,canonical-template-lint,canonical-markdown-contract}.test.mjs`

**Interfaces:**
- Produces: `WORKFLOW_ARTIFACTS` containing `development-contract.md`; strict structural contracts for the main artifact and five fragments.
- Consumes: the exact approved headings, tables and placeholder names from the v0.8 spec.

- [x] Add failing tests for the eleven-file set, README navigation, removed duplicate fields, fragment allowlists and completed development-contract validation.
- [x] Run the four focused test files and confirm failure because the new artifact and contracts do not exist.
- [x] Add the main and fragment templates and the minimum parser/allowlist changes.
- [x] Re-run the focused tests and confirm they pass.

### Task 2: Workflow enforcement and agent reading protocol

**Files:**
- Modify: `plugins/coding-harness/runtime/state.mjs`
- Modify: `plugins/coding-harness/skills/{solution-design,task-implementation,harness-orchestrator}/SKILL.md`
- Modify: `plugins/coding-harness/runtime/navigation.mjs`
- Test: `plugins/coding-harness/tests/canonical-workflow.test.mjs`

**Interfaces:**
- Consumes: completed `development-contract.md` before task-package approval and development entry.
- Produces: deterministic rejection for missing, unresolved or structurally invalid common contracts.

- [x] Add a failing transition test proving an invalid common contract blocks task-package approval.
- [x] Run the workflow test and confirm the expected contract failure.
- [x] Add the artifact to design/development dependency closure and update Skills to require each task to read it.
- [x] Re-run the workflow test and confirm it passes.

### Task 3: Canonical documentation and version synchronization

**Files:**
- Modify: `技术设计-流程模块与交接协议.md`, `ADR-latest.md`, `AI-dev-harness.html`
- Modify: `README.md`, `plugins/coding-harness/README.md`, `plugins/coding-harness/templates/README.md`, `docs/INSTALL-CODEBUDDY-IDE.md`
- Modify: `plugins/coding-harness/.codebuddy-plugin/plugin.json`, `plugins/coding-harness/package.json`, `.codebuddy-plugin/marketplace.json`
- Modify: `docs/插件修复与验收执行清单.md`, `docs/目录与模板二次核查报告.md`
- Test: `plugins/coding-harness/tests/{canonical-layout,canonical-document-consistency,canonical-release}.test.mjs`

**Interfaces:**
- Produces: one v0.8 document tree, exact technical-design/template snapshots and consistent release metadata.

- [x] Add or update assertions for ten workflow body templates, eleven total artifacts and version 0.8.0.
- [x] Run focused documentation tests and confirm they fail against v0.7 content.
- [x] Synchronize every current specification and user-facing surface.
- [x] Re-run focused tests and confirm they pass.

### Task 4: Package, independent acceptance and Git release

**Files:**
- Modify: `_build/package-marketplace.py`
- Create: `dist/ai-market-0.8.0.zip`

**Interfaces:**
- Consumes: the validated v0.8 source tree.
- Produces: a ZIP whose entry names and bytes exactly match the release sources.

- [x] Run `npm test` and `npm run validate` under `plugins/coding-harness`.
- [x] Dispatch independent read-only acceptance for rules/workflow, templates, and package/document consistency; fix any blocking findings with focused regression tests.
- [x] Build `dist/ai-market-0.8.0.zip` and compare every ZIP file byte-for-byte with the source.
- [x] Stage only v0.8 release files and commit with `release: coding harness 0.8.0`.
