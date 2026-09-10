---
description: Start one canonical workflow after the administrator checklist is complete.
argument-hint: "<operation> <title> [--material <raw user text>]"
---

Treat `$ARGUMENTS` as `<operation> <title> [--material <raw user text>]`. First run `node "${CODEBUDDY_PLUGIN_ROOT}/bin/harness.mjs" doctor`. If it fails, show the exact next action and stop. Otherwise run `node "${CODEBUDDY_PLUGIN_ROOT}/bin/harness.mjs" start $ARGUMENTS`. Start inventories every visible project file in `source-materials.md` and, when supplied, records the raw user text as a `用户原话` row. It does not assume README, `docs/`, a fixed directory or extension contains original material. The returned state deliberately remains at `requirement/source_materials`; only a later explicit `transition ... {"action":"record_source_materials",...}` records the node and moves to candidate review. Do not create a candidate conclusion, published requirement, design or task package from the same natural-language call.
