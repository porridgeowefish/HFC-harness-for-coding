# Coding Harness

Version 0.9.0 provides one natural-language `harness` Skill with stage procedures in `skills/harness/references/`. Each invocation loads only the reference for the current state and advances at most one workflow node.

Initialization inventories every visible project path without assuming conventional material locations. The main Agent partitions explicit paths between bounded business and engineering writers; a Rules writer consumes completed knowledge only. The runtime exclusively writes `文件树.md` and renders human-readable SVG diagrams. Writers have explicit tool allowlists and turn limits, so they cannot rescan the repository indefinitely.

`SessionStart` injects only the unfinished count and the most recently updated workflow. `PreToolUse` denies deterministic violations but never returns an allow decision that bypasses CodeBuddy permissions. Git is the only shared version mechanism.

Daily use is natural language: initialize Harness, start or continue development, view progress, review an MR, or update knowledge. `init`, `doctor`, `start`, `status` and `transition` remain deterministic administrator and troubleshooting entry points. A workflow has eleven human-readable artifacts and one local machine-state file; `development-contract.md` is the common contract read by every development task.
