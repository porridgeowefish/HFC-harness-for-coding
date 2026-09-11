# 共同开发契约

## 契约范围
- 适用需求：<requirement-or-criterion-id-list>。
- 适用任务：<task-id-list>。
- 明确排除：<explicitly-excluded-contract-scope>。

## 契约清单
| 契约 ID | 类型 | 提供方 | 使用方 | 实现事实源 | 验证方式 |
| --- | --- | --- | --- | --- | --- |
| <contract-id> | <API/公共接口/数据/共享行为/跨任务集成> | <provider-task-or-component> | <consumer-task-or-component> | `<runtime-resolved-source-location>` | <verification-method> |

<applicable-contract-blocks>

## 全任务共同门禁
| 门禁 | 适用任务 | 通过条件 |
| --- | --- | --- |
| <runtime-discovered-gate-name> | <task-id-list> | <observable-pass-condition> |
