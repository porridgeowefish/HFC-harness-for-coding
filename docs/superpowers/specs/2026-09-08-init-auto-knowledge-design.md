# Init 自动知识生成与交互重构设计

> **已废止：** 本文件记录第五版探索方案。0.7.0 以 `docs/superpowers/specs/2026-09-09-v07-distributed-initialization-and-markdown-contract.md` 为准；其中“无草案应用骨架”“SVG 占位”“额外描述 JSON”、旧工程模块摘要字段等内容均不再有效。

## Status

Approved,含 2026-09-08 修订:撤销自创的 `docs/knowledge/architecture/工程细节.md`(设计稿无此产物),工程细节改按需落 `docs/knowledge/modules/<工程模块>.md`(草案字段 `engineeringDetails` 改为 `engineeringModules`,每项 {name, summary});architecture/ 回到设计稿原样,只含 component.puml 与 component.svg。修订原因:设计稿是规范源头,实现不得反向增改设计;modules/ 按需机制已覆盖"工程入口所指细节"需求。

用户 2026-09-08 拍板:architecture/ 保留(组件图+工程细节职责由 modules/ 承担);function 由阅读文档+代码推断生成(标待确认);文档随代码同步改。本设计将 init 从"生成空骨架等管理员手填"重构为"自动读项目、填实知识库、管理员只做确认"。

## 反馈映射

| 用户反馈 | 设计响应 |
| --- | --- |
| 1. init 只建空文件,不读项目、不生成 knowledge/function/rules 内容 | init 草案阶段自动识别项目并生成知识草案;`--apply` 需带 `--knowledge <file>` 草案才填实,缺草案 fail-closed 仅骨架并明示 |
| 2. 文件树格式不对,应 tree 形式 | `refreshFileTree` 改树形缩进输出,描述保留机制不变 |
| 3. CODEBUDDY.md 加全局规则;architecture 与 knowledge 重复 | 加 Karpathy 4 行行为规则;architecture/ 保留,职责收紧为"组件图 + 工程细节",三份导航 md 不入 architecture(实测 init 无重复生成,重复系会话 AI 手误,职责收紧消除歧义) |
| 4. Skill 不引导用户,输出内部实现 | harness-orchestrator 增"用户输出协议",其余 skill 引用 |

## 目录职责(canonical)

```
docs/knowledge/
  项目总览.md / 文件树.md / 业务入口.md      ← 导航三件套,只在 knowledge 根
  architecture/                              ← 仅组件图源+渲染(设计稿原样)
    component.puml / component.svg
  modules/<工程模块>.md                      ← 按需;init 草案的 engineeringModules 据此创建,内容为推断+待确认标注
docs/function/
  module.json
  <业务模块>/<功能点>/功能描述.md、功能演变历史.md   ← init 时由草案带业务模块/功能点清单,内容为推断+待确认标注
```

`architecture/` 只含组件图两件产物,与设计稿第 2 节一致——contract 的 CANONICAL_PROJECT_FILES 与 validate-package 的目录清单共同锁定。

## Init 工作流(重构后)

1. `harness init`(无 --apply):扫描项目 → 产出 `{discovery, knowledgeDraft}` 草案 JSON。扫描扩展:README(.md/.rst/.txt)、go.mod、pom.xml、build.gradle、pyproject.toml、requirements.txt、Cargo.toml、composer.json、package.json;识别语言/框架/包管理器/源码根/入口命令/模块目录。
2. 宿主 AI(由 harness-orchestrator skill 编排)读草案,实际阅读项目文档与代码(subagent),补全 knowledgeDraft:`project`(用途/技术栈/入口/顶层模块/未识别项)、`businessModules`(业务模块+功能点清单+每功能推断的功能描述)、`engineeringDetails`(工程细节条目,落 `architecture/工程细节.md`)、`componentDiagram`(PlantUML 文本)、`fileTreeDescriptions`(关键文件用途)、`ruleAdjustments`(各 rule 文件的具体条目)。
3. `harness init --apply --knowledge <draft.json>`:校验草案(必需键、非空、无 `<...>` 占位符残留;组件图必须可解析 @startuml/@enduml)→ 写实 项目总览/业务入口/文件树描述/rules/组件图/按需 modules 工程模块说明/function 模块与功能点目录 → checklist 生成。
4. 无 --knowledge 的 `--apply`:仍执行,但只生成骨架并在结果 JSON 明示 `knowledgeFilled: false` 与原因(供演示/无宿主环境)。**checklist 第八项 project_materials 语义不变**,由管理员对已填内容逐项审核确认——自动填充不豁免人工确认。

草案 schema(fail-closed 校验):

```json
{
  "schemaVersion": "1.0",
  "project": {"purpose": "...", "stack": ["go1.22"], "entrypoints": ["go run ./cmd/server"], "topModules": ["cmd/", "internal/"], "unrecognized": []},
  "businessModules": [{"module": "订单", "features": [{"name": "下单", "summary": "推断的功能描述(待确认)"}]}],
  "engineeringDetails": ["路由注册统一在 cmd/server/main.go"],
  "componentDiagram": "@startuml\n...\n@enduml",
  "fileTreeDescriptions": {"main.go": "程序入口:HTTP server 启动与路由注册"},
  "ruleAdjustments": {"engineering.md": ["错误处理:统一 pkg/errors 包装"]}
}
```

## 文件树树形输出

```markdown
- `main.go` — 程序入口:HTTP server 启动与路由注册
- `internal/` — 业务逻辑
  - `handler/` — HTTP 处理器,按业务域拆分
    - `order.go` — 订单路由
```

顶层排序:文件与目录混排按名称;缩进两级空格;`- \`path\` — 描述` 行格式不变,描述保留逻辑(descriptions map 键为完整相对路径)不变——**既有文件解析旧格式的能力移除**,初始化即新格式,无历史项目迁移负担(0.4.0 尚未对外发布过)。

## CODEBUDDY.md 全局行为规则

来源:Karpathy 2026-01 诊断帖衍生的四行规则(GitHub 60k star 的 CLAUDE.md 行为节)。写入模板:

```markdown
## 全局行为规则(所有会话、所有工具生效)

1. 不臆测。不隐藏困惑。暴露权衡取舍。
2. 用最少的代码解决问题。不写投机性代码。
3. 只动必须动的。只清理自己留下的。
4. 明确成功标准,循环直到验证通过。

项目专属规则写入 `.codebuddy/rules/`,不写入本文件。
```

## Skills 用户输出协议

harness-orchestrator SKILL.md 末尾新增:

> **用户输出协议**:与用户交流时:一句话说明当前流程位置 → 最多 3 行下一步选项(带推荐)→ 需要决策时只呈现决策点与选项。JSON、内部状态、命令细节、revision 等仅管理员索要或排障时展示。复杂留给系统,简单留给用户。

其余 5 个 SKILL.md 各加一行引用。

## 实现清单

| 文件 | 改动 |
| --- | --- |
| runtime/onboarding.mjs | discoverProject 多语言扫描;initKnowledgeDraft 读取+校验;apply 时填实;输出含 knowledgeFilled |
| runtime/navigation.mjs | refreshFileTree 树形输出 |
| runtime/knowledge.mjs | 导出 createModuleFeatureFromDraft 供 init 填 function(复用现有校验/回滚),或 init 直接内联同等逻辑 |
| runtime/contract.mjs | 撤销修订后不再新增固定产物;CANONICAL_PROJECT_FILES 保持设计稿原样 |
| templates/project/CODEBUDDY.md | 4 行全局规则 |
| skills/*/SKILL.md | 输出协议 |
| bin/harness.mjs | `init --knowledge <file>` 参数 |
| tests/canonical-init-knowledge.test.mjs | 新增:草案校验/填实/占位符拒绝/失败原子性 |
| tests/canonical-layout.test.mjs | 文件树树形断言;architecture 清单断言 |
| 技术设计文档 | §2 目录节、§9 模拟样例同步 |
| templates/README.md、docs/INSTALL-CODEBUDDY-IDE.md | 映射与教程同步 |

**决策(已修订):工程细节如何承载?** 最初定为自创的 init 固定产物 `architecture/工程细节.md`,用户指出设计稿无此产物后撤销;工程细节改按需落 `modules/<工程模块>.md`(草案 `engineeringModules`,每项 {name, summary}),与设计稿既有机制一致。

**决策:component.svg 如何处理?** 保留为渲染位:草案含 componentDiagram 时写 puml,svg 仍为占位(运行时无 PlantUML 渲染器,不冒充渲染);标题行注明"待渲染"。用户已定 architecture 承载组件图+工程细节,svg 占位与其职责一致。

**决策:rules 填实程度?** ruleAdjustments 只往五份 rules 的既有小节追加条目,不改"适用场景"首行(运行时校验依赖);无 adjustment 的文件保持骨架。业务规则不写入 rules(rules 是工程规约,业务事实在 function)。

## 验证标准

1. 全量 npm test 通过(含新增 canonical-init-knowledge)。
2. npm run validate 通过。
3. 冒烟:临时 go 项目样本(go.mod+main.go+internal/)跑 `init`(草案)→ 模拟宿主补草案 → `--apply --knowledge` → 断言:项目总览无占位符、文件树为树形且含真实描述、architecture 下仅 puml+svg、modules/ 下按需工程模块说明、function 下有业务模块/功能点目录、rules 含追加条目。
4. 重打 dist/ai-market-0.4.0.zip,zip 内抽查关键文件。
