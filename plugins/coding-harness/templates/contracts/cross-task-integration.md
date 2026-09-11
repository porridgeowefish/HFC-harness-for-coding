## <contract-id> · 跨任务集成

### 任务接口
| 提供任务 | 使用任务 | 输入 | 输出 | 错误语义 |
| --- | --- | --- | --- | --- |
| <provider-task-id> | <consumer-task-id> | <integration-input> | <integration-output> | <integration-error-semantics> |

### Mock / Stub
| 使用任务 | 替代对象 | 模拟内容 | 必须保持一致 | 结束条件 |
| --- | --- | --- | --- | --- |
| <consumer-task-id> | <substituted-component> | <mock-or-stub-behavior> | <contract-id-or-schema> | <switch-to-real-integration-condition> |

### 联调时机
| 参与任务 | 准入条件 | 联调动作 | 通过条件 |
| --- | --- | --- | --- |
| <task-id-list> | <integration-entry-condition> | <integration-action> | <observable-pass-condition> |
