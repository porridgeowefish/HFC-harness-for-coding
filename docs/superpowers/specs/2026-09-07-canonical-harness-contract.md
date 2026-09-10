# Canonical Coding Harness Contract

> **历史基线（非现行合同）**：本文件保留 2026-09-07 的基础布局与状态原则；0.7.0 的动态初始化、Markdown 结构合同、Hook 作用域和字段口径以 `2026-09-09-v07-distributed-initialization-and-markdown-contract.md`、《技术设计-流程模块与交接协议》和 `ADR-latest.md` 的 0.7.0 增补为准。本文件中的旧字段或机制不得重新生成。

## Status

Approved implementation contract. `技术设计-流程模块与交接协议.md` is the canonical source for generated-project paths, workflow artifacts, state handoff, Rules, configuration and template behavior. `ADR-latest.md` supplies compatible fail-closed, human-approval, immutable-snapshot and evidence principles only; historical alternatives do not form part of this contract.

## Canonical generated-project layout

```text
.gitignore
CODEBUDDY.md
docs/
  knowledge/
    项目总览.md
    文件树.md
    业务入口.md
    architecture/component.puml
    architecture/component.svg
    modules/<engineering-module>.md
  function/
    module.json
    <business-module>/function.json
    <business-module>/<feature>/功能描述.md
    <business-module>/<feature>/功能演变历史.md
  workflows/README.md
  workflows/<workflow-id>/
    README.md
    source-materials.md
    candidate-review.md
    requirement.md
    design-alignment.md
    design-decision.md
    task-package.md
    development-summary.md
    knowledge-update-review.md
    merge-report.md
.codebuddy/
  settings.json
  harness.json
  onboarding-checklist.json
  agents/code-reviewer.md
  rules/
    architecture.md
    engineering.md
    testing.md
    api-and-data.md
    commit-and-mr.md
  workflows/<workflow-id>/state.json
```

`docs/knowledge/`, `docs/function/` and `docs/workflows/` are the only human-readable document roots. `.codebuddy/workflows/` is local runtime state and is the only ignored subtree. The old roots `docs/project/`, `knowledge/`, `requirements/`, old three-rule layout and `experience-candidates.md` are forbidden.

Plugin packaging uses `templates/project/` for the startup skeleton, `templates/workflow/` for one task, `templates/business/` for on-demand feature documents, and `templates/engineering/` for on-demand engineering notes. Real names replace notation in paths; no literal placeholder directories are created. The project reviewer is copied from the plugin's single `agents/code-reviewer.md` source. Configuration, checklist and state JSON are runtime-generated. Local `evidence/` is created only when a local evidence producer needs it; external evidence stays referenced by location. The template index explains these mappings; it is not itself a generated-project template.

## Workflow and handoff contract

Every workflow contains exactly the ten listed artifacts. `state.json` carries relative artifact paths, workflow stage/step/status, bounded task records, approval records, gates, MR snapshot information, blockers and `artifacts.evidence_refs`. It never copies Markdown bodies or requires a particular evidence filename, extension or count. State writes are atomic and reject missing artifacts, illegal transitions and stale commit-bound evidence. Human approval records contain the responsible person and time; Git preserves document versions, so no content digest is added.

Stages are requirement, design, development, review, knowledge_review and completed. Knowledge review is an explicit pre-merge state: it is generated after an independent review has no blocker; each long-lived asset is classified as `需要更新`, `无需更新` or `待人裁定`; any `待人裁定` blocks finalization. Approved knowledge edits invalidate review/report evidence for the earlier commit.

## Rules and configuration contract

The only generated Rules are `architecture.md`, `engineering.md`, `testing.md`, `api-and-data.md` and `commit-and-mr.md`. Each begins with a machine-readable `适用场景:` declaration. The runtime maps operation classes to mandatory Rules: module/refactor → architecture+engineering; API/data/persistence → architecture+api-and-data; tests → testing; commit/MR/report → commit-and-mr; unfamiliar read-only exploration → architecture plus relevant `docs/knowledge/` navigation.

`.codebuddy/harness.json` contains exactly `schemaVersion`, `adapterVersion`, `project`, `protectedContracts`, `gates` and `integrations`. Commands use separate executable and argument arrays, run without a shell, and have project-root-bounded working directories.

`.codebuddy/onboarding-checklist.json` records the eight administrator checks from the design: three context/integration checks, three knowledge/Rules checks and two material/template checks. Each item has an ID, status, actor and timestamp. The first workflow may be created only when all eight are confirmed. `doctor` reports every incomplete item and the single next action.

## Template contract

Templates define fields, enumerations and admission rules only. Runtime values use `<...>` placeholders. They contain no Mustache placeholders, project/business cases, fixed task or requirement IDs, source-code paths, commands, test names, assertion counts, evidence locations, platform names, fixed evidence counts or pre-filled pass/fail conclusions. A complete scenario is permitted only outside template roots and must explicitly be labelled non-template.

## Completion criteria

The package is accepted only when:

1. A fresh initialized project exactly matches the canonical directory manifest and has no forbidden legacy root.
2. A created workflow contains all ten artifacts and state references every artifact using project-relative paths.
3. Invalid or stale transitions preserve the prior `state.json` bytes.
4. Incomplete checklist, missing Rule declaration, missing artifact, stale approval, unresolved knowledge classification and stale MR evidence all fail closed.
5. The nine workflow body templates match the technical design's Markdown blocks exactly; all package directories, including empty directories, and generated destinations are verified. Runtime-specific values remain placeholders in templates.
6. All automated tests and package validation pass, followed by independent acceptance audits for Rules, configuration/checklist, orchestration and template robustness.
