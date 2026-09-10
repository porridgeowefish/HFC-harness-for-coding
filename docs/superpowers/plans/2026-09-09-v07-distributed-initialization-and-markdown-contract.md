# V0.7 Distributed Initialization and Markdown Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Release Coding Harness 0.7.0 with dependency-driven subagent initialization, real file-tree backfill, a single explicit Markdown contract, scoped Hooks, and synchronized design/user documentation.

**Architecture:** The natural-language orchestrator builds a runtime task graph from the full project inventory. A reconnaissance task writes the file-tree skeleton, disjoint engineering and business tasks read assigned files and directly write their documents, a synthesis task writes project navigation and diagrams, and a Rules task writes the five Rules after its knowledge inputs exist. A shared Markdown contract parser validates templates and completed project assets; the main Agent schedules and repairs failed owners but does not insert a human review stage.

**Tech Stack:** Node.js 20+ ESM, `node:test`, Markdown/JSON, SVG XML, Python ZIP packaging, Git.

**Spec:** `docs/superpowers/specs/2026-09-09-v07-distributed-initialization-and-markdown-contract.md`

## Global Constraints

- Version all plugin/package/manifest/user-facing release metadata as `0.7.0`.
- Preserve the canonical generated roots and ten workflow artifacts from the technical design.
- File-tree skeleton rows may contain only a path during discovery; completed rows must contain a concrete evidence-based purpose.
- Each readable project file is assigned exactly once to an initialization reader; concurrent writers must own disjoint paths.
- Rules are normative constraints plus links to knowledge; they do not copy knowledge bodies.
- No digest, content hash, CAS, initialization lock, or second confirmation chain.
- An uninitialized project must experience no Harness Hook side effects.
- Use `apply_patch` for source and document edits; preserve unrelated workspace files.

---

### Task 1: Add the explicit Markdown contract parser and failing tests

**Files:**
- Create: `plugins/coding-harness/runtime/markdown-contract.mjs`
- Modify: `plugins/coding-harness/runtime/template-lint.mjs`
- Modify: `plugins/coding-harness/scripts/validate-package.mjs`
- Create: `plugins/coding-harness/tests/canonical-markdown-contract.test.mjs`
- Modify: `plugins/coding-harness/tests/canonical-template-lint.test.mjs`

**Interfaces:**
- `parseMarkdownStructure(text): { title, headings, tables, bodyLines }` parses headings, table headers and ordinary lines without a third-party dependency.
- `validateTemplateContract(relativePath, text): string[]` applies an allowlist for each known template family and validates exact titles, heading order, table headers and declared `<...>` placeholders.
- `validateCompletedDocument(relativePath, text, options): string[]` rejects unresolved placeholders, generic tree descriptions, unknown headings, malformed tables and missing required sections.
- `allowedPlaceholders(relativePath): Set<string>` returns the exact placeholder tokens declared for the template path.

- [x] **Step 1: Write failing tests** for an extra heading, a reordered table header, an undeclared placeholder, a dynamic fact embedded in ordinary prose, a bare completed tree row, and a generic `用途待确认` description.
- [x] **Step 2: Run** `node --test plugins/coding-harness/tests/canonical-markdown-contract.test.mjs plugins/coding-harness/tests/canonical-template-lint.test.mjs`; verify the new assertions fail against the current blacklist-only linter.
- [x] **Step 3: Implement** line-oriented parsing and explicit contract maps for `CODEBUDDY.md`, knowledge navigation, engineering modules, business documents, Rules, workflow README and the nine workflow body templates. Keep the existing technical-design extraction test as an exact workflow contract check.
- [x] **Step 4: Replace** package validation's blacklist-only template decision with `validateTemplateContract` for all plugin templates; keep blacklist matches as diagnostics only for unclassified explanatory documents.
- [x] **Step 5: Run** the focused tests and confirm all new contract assertions pass.

### Task 2: Make project templates express the 0.7 document formats

**Files:**
- Modify: `plugins/coding-harness/templates/project/CODEBUDDY.md`
- Modify: `plugins/coding-harness/templates/project/docs/knowledge/项目总览.md`
- Modify: `plugins/coding-harness/templates/project/docs/knowledge/文件树.md`
- Modify: `plugins/coding-harness/templates/project/docs/knowledge/业务入口.md`
- Modify: `plugins/coding-harness/templates/engineering/模块说明.md`
- Modify: `plugins/coding-harness/templates/business/功能描述.md`
- Modify: `plugins/coding-harness/templates/business/功能演变历史.md`
- Modify: `plugins/coding-harness/templates/project/.codebuddy/rules/architecture.md`
- Modify: `plugins/coding-harness/templates/project/.codebuddy/rules/engineering.md`
- Modify: `plugins/coding-harness/templates/project/.codebuddy/rules/testing.md`
- Modify: `plugins/coding-harness/templates/project/.codebuddy/rules/api-and-data.md`
- Modify: `plugins/coding-harness/templates/project/.codebuddy/rules/commit-and-mr.md`

**Interfaces:**
- Every template exposes only its contract placeholders and the exact 0.7 heading/table sequence.
- The engineering module template contains `模块定位`, `目录与入口`, `核心组成`, `主要流程`, `跨端关系`, `兼容边界`, `生效机制`, `易误判点`, `事实依据`.
- Rules contain `必须遵守`, `相关知识入口`, `验证方式`, `更新门槛` after the machine-readable applicability line.

- [x] **Step 1: Update** templates to the exact sections in the spec, using declared placeholders for dynamic fields and no project examples.
- [x] **Step 2: Add** an in-progress file-tree skeleton form that contains paths only, while retaining the completed `— purpose` form as the generated contract.
- [x] **Step 3: Run** the contract tests and package validator; confirm no template contains undeclared dynamic facts or obsolete `constraints/`/`gates` paths.

### Task 3: Extend the initialization data contract and direct writers

**Files:**
- Modify: `plugins/coding-harness/runtime/onboarding.mjs`
- Modify: `plugins/coding-harness/runtime/navigation.mjs`
- Modify: `plugins/coding-harness/runtime/contract.mjs`
- Modify: `plugins/coding-harness/runtime/knowledge.mjs`
- Modify: `plugins/coding-harness/tests/init-draft.mjs`
- Modify: `plugins/coding-harness/tests/canonical-init-knowledge.test.mjs`
- Modify: `plugins/coding-harness/tests/canonical-layout.test.mjs`

**Interfaces:**
- `validateKnowledgeDraft` accepts the 0.7 structured project, engineering, business and Rules objects and rejects the 0.6 summary-only shape.
- `scanProjectMaterials` and the file-tree builder expose every visible file and directory, with classifications for readable, binary, unreadable and symbolic-link entries.
- `applyKnowledgeDraft` renders the fixed 0.7 sections, row-per-feature business navigation and a valid SVG from the same PlantUML model.
- `initializeProject` supports an internal prepare/finalize boundary used by the orchestrator without creating a completed-looking document skeleton.

- [x] **Step 1: Rewrite** `init-draft.mjs` with architecture, module, feature, evidence, knowledge-reference and structured Rule data.
- [x] **Step 2: Add failing tests** for missing architecture fields, missing module sections, missing feature sections, missing evidence paths, incomplete tree backfill and old summary-only module data.
- [x] **Step 3: Implement** strict draft validation and path-bound evidence checks; preserve atomic failure before any document write.
- [x] **Step 4: Implement** tree skeleton creation followed by owner backfill. Reject finalization if any readable file remains bare or has a generic purpose.
- [x] **Step 5: Implement** full project overview, software architecture section, business-entry rows, concrete engineering module documents, function documents/history and Rules rendering.
- [x] **Step 6: Add** a no-history function record that explicitly states there are no accepted historical changes without inventing a change.
- [x] **Step 7: Run** focused initialization/layout tests, then the full plugin tests.

### Task 4: Implement dependency-driven subagent orchestration instructions

**Files:**
- Modify: `plugins/coding-harness/skills/harness-orchestrator/SKILL.md`
- Modify: `plugins/coding-harness/commands/init.md`
- Modify: `plugins/coding-harness/templates/README.md`
- Modify: `plugins/coding-harness/tests/canonical-onboarding.test.mjs`
- Modify: `plugins/coding-harness/tests/canonical-contract.test.mjs`

**Interfaces:**
- The top-level Skill describes a dynamic dependency graph and owner-based direct writes, not a fixed user-facing numbered tutorial.
- The coordinator sends each readable path to exactly one reader task, waits for dependencies, and allows parallel tasks only for disjoint write scopes.
- The user-facing contract remains natural language; JSON and internal task graph details are shown only for administrator troubleshooting.

- [x] **Step 1: Add failing tests** that assert the Skill names tree skeleton/backfill, direct subagent writes, disjoint ownership, dependency waits and absence of a human review round.
- [x] **Step 2: Update** the orchestrator Skill with the dynamic task graph, role contracts, failure re-dispatch and final structural check.
- [x] **Step 3: Update** the init command and template index so CLI remains a controlled fallback while natural language remains the primary entry.
- [x] **Step 4: Run** onboarding and contract tests.

### Task 5: Scope Hooks to Harness-managed projects

**Files:**
- Create: `plugins/coding-harness/runtime/project-scope.mjs`
- Modify: `plugins/coding-harness/hooks/pre-tool-use.mjs`
- Modify: `plugins/coding-harness/hooks/session-start.mjs`
- Modify: `plugins/coding-harness/tests/canonical-hooks.test.mjs`

**Interfaces:**
- `detectHarnessScope(projectRoot): 'managed' | 'broken' | 'absent'` returns `managed` for a valid `.codebuddy/harness.json`, `broken` for an orphan onboarding checklist, and `absent` when neither Harness marker exists.
- Unmanaged projects receive an allow/no-op Hook result; managed projects retain state, ignore-rule and preCommit protections; broken projects fail closed with a repair message.

- [x] **Step 1: Add failing tests** for an unmanaged project's commit, `.gitignore` edit and SessionStart; assert none reads or runs Harness state/configuration.
- [x] **Step 2: Implement** the shared scope detector and guard every Harness-specific branch in both Hooks.
- [x] **Step 3: Preserve** the existing managed-project gate-failure and shared-contract protection tests.
- [x] **Step 4: Run** the focused Hook tests and full regression.

### Task 6: Synchronize ADR, technical design, HTML, rules documentation and release metadata

**Files:**
- Modify: `ADR-latest.md`
- Modify: `技术设计-流程模块与交接协议.md`
- Modify: `AI-dev-harness.html`
- Modify: `README.md`
- Modify: `plugins/coding-harness/README.md`
- Modify: `docs/INSTALL-CODEBUDDY-IDE.md`
- Modify: `docs/目录与模板二次核查报告.md`
- Modify: `plugins/coding-harness/package.json`
- Modify: `plugins/coding-harness/.codebuddy-plugin/plugin.json`

**Interfaces:**
- The three specification surfaces use the same generated layout, Markdown headings, Rules/knowledge distinction, dynamic initialization model and 0.7.0 version.
- The HTML remains a non-template explanatory simulation and contains no obsolete `constraints/`, `.githooks/`, fixed CI script or eight-file claim.

- [x] **Step 1: Add** the approved 0.7 decision section to `ADR-latest.md` and update the canonical technical design sections for module formats, architecture overview and dynamic orchestration.
- [x] **Step 2: Update** the HTML file tree, Rules/knowledge cards, module format, initialization narrative and appendix to match the actual package.
- [x] **Step 3: Update** installation, plugin README, root README and the verification report to 0.7.0 and the new direct-write model.
- [x] **Step 4: Run** cross-document consistency tests and search for obsolete paths/versions.

### Task 7: Full verification, Git snapshot and marketplace package

**Files:**
- Modify: `docs/目录与模板二次核查报告.md`
- Create: `dist/ai-market-0.7.0.zip`

- [x] **Step 1: Run** `npm test --prefix plugins/coding-harness` and require zero failures.
- [x] **Step 2: Run** `npm run validate --prefix plugins/coding-harness` and require zero violations.
- [x] **Step 3: Run** a temporary-project smoke test covering distributed-init instructions, concrete Markdown output, SVG, Rules references, unmanaged Hook no-op and managed preCommit blocking.
- [x] **Step 4: Initialize or use the repository Git history without adding content hashes; record the 0.7.0 snapshot and changed-file list.**
- [x] **Step 5: Build** the UTF-8 marketplace ZIP with `_build/package-marketplace.py`, verify manifest/package/README versions and source/archive byte equality for every packaged file.
- [x] **Step 6: Record** exact test, validation, smoke-test and package evidence in the verification report; do not claim external CodeBuddy integration that was not run.
