# 长期知识更新审核单

## 1. 审核对象
- 任务 ID：<workflow-id>
- MR / Commit：<mr-identifier> / <reviewed-commit>
- 需求与设计依据：`requirement.md`、`design-decision.md`
- 代码与验证依据：`development-summary.md`、`EV-<runtime-generated-id>`（<evidence-purpose>）
- 审核状态：<pending/approved/returned/rejected>

## 2. 影响判定总览
| 长期资产 | 判定 | 理由 | 本轮动作 | 证据 |
| --- | --- | --- | --- | --- |
| `<required-long-term-asset>` | <需要更新/无需更新/待人裁定> | <fact-based-rationale> | <update/no-change/human-decision> | `EV-<runtime-generated-id>`：<what-the-evidence-proves> |

## 3. 更新草案
### <update-id> · <update-title>
- 目标文件：`<approved-long-term-asset-path>`
- 草案：<proposed-current-fact-or-rule-change>。
- 替代/删除内容：<superseded-content-or-none>。
- 保留理由：<why-this-knowledge-must-remain-long-lived>。

## 4. 审核结论
- 审核人：<reviewer>
- 审核时间：<timestamp>
- 结论：<通过/退回修改/不通过>
- 审核意见：<review-comment>
- 已批准更新项：<approved-update-id-array>

## 5. 实施记录
- 实施状态：<待实施/已实施/实施失败>
- 实际修改文件：<runtime-resolved-changed-location-array>
- 知识更新 Commit：<knowledge-update-commit>
- 最终独立评审 Commit：<final-reviewed-commit>
- 说明：知识更新产生新 Commit 后，必须重新执行独立评审；未通过前不得生成最终合并报告。
