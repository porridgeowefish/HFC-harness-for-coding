---
description: Initialize only the canonical Coding Harness document system.
argument-hint: "[--phase prepare|finalize] [--apply --knowledge <draft.json>]"
---

In the current project directory, the top-level natural-language Skill is the primary entry. The runtime inventories the complete visible tree and writes the path-only skeleton; the main Agent never reads source contents. It assigns disjoint batches of at most 20 readable files to business or engineering writers, with one business module or engineering boundary per instance. Engineering writers also own `api/`, `data/`, `integration/` and `decisions/`; discovered domains must be produced during initialization. Final consolidation reads completed knowledge only. `rules-writer` then writes only the five Rules. `docs/knowledge/文件树.md` is written only by the runtime, and the runtime renders `component.svg`. The CLI remains deterministic and compact. Do not add a digest, hash, CAS or second review round. A single administrator commits the shared contracts to Git; other members pull them.
