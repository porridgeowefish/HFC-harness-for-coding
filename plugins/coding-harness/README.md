# Coding Harness

Version 0.9.1 provides one natural-language `harness` Skill with stage procedures in `skills/harness/references/`. Each invocation loads only the reference for the current state and advances at most one workflow node.

Initialization inventories every visible project path without assuming conventional material locations. Source contents stay out of the main Agent context: it assigns batches of at most 20 files to business or engineering writers. Engineering modules follow build/runtime/code ownership rather than business domains, and detected API, data, integration and decision knowledge is mandatory during initialization. The runtime exclusively writes `文件树.md` and renders human-readable SVG diagrams.

`SessionStart` injects only the unfinished count and the most recently updated workflow. `PreToolUse` denies deterministic violations but never returns an allow decision that bypasses CodeBuddy permissions. Git is the only shared version mechanism.

Daily use is natural language: initialize Harness, start or continue development, view progress, review an MR, or update knowledge. `init`, `doctor`, `start`, `status` and `transition` remain deterministic administrator and troubleshooting entry points. A workflow has eleven human-readable artifacts and one local machine-state file; `development-contract.md` is the common contract read by every development task.
