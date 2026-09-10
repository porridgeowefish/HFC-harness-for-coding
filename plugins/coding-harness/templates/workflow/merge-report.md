# 代码合并报告

## 1. 基本信息
- MR：<mr-identifier>
- 分支：<source-branch>
- Commit：<final-reviewed-commit>
- 任务 ID：<workflow-id>
- 生成时间：<timestamp>

## 2. 本次变更
- 目标：<approved-change-goal>。
- 影响范围：<actual-changed-components-or-areas>。
- 不涉及：<explicitly-out-of-scope-items>。

## 3. 需求实现与验证
| 需求/验收标准 | 关联任务 | 实现位置 | 验证证据 | 覆盖状态 |
| --- | --- | --- | --- | --- |
| <requirement-or-criterion-id-and-summary> | <task-id> | `<runtime-resolved-location>` | `EV-<runtime-generated-id>`：<what-the-evidence-proves> | <covered/partially-covered/not-covered/not-applicable> |

## 4. 测试与质量门禁
| 检查 | 结果 | 证据 |
| --- | --- | --- |
| <runtime-discovered-gate-name> | <passed/failed/not_configured/not_run> | `EV-<runtime-generated-id>`：<what-the-evidence-proves> |

## 5. 独立代码评审
- BLOCKER：<runtime-generated-count>。
- WARNING：<runtime-generated-count-and-status>。
- INFO：<runtime-generated-count-and-status>。

## 6. 安全扫描
- 状态：<passed/failed/not_configured/not_run>。
- 说明：<scan-scope-findings-and-any-exemption>。

## 7. 遗留问题与风险
- <none-or-unresolved-item-with-impact-and-recommendation>。

## 8. 合并结论
- 建议：<可以合并/不建议合并/需要人工判断>。
- 前提：<remaining-platform-or-approval-condition>。
