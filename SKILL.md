---
name: ai-pipeline
description: AI Pipeline 编排初始化器。扫描项目技术栈 → 生成 Agent 定义 → 生成 Orchestrator Skill → 部署适配器 → 启动 Server。用户说"初始化流水线""设置 AI 编排""init pipeline""配置 pipeline"时触发。
---

# AI Pipeline 编排初始化器

加载本 Skill 后，你将为目标项目配置完整的 AI 开发流水线编排环境。

## 前置检测

1. 检测当前项目是否已有 `.cursor/skills/orchestrator-*/SKILL.md`（或对应 IDE 的路径）
2. **已存在** → 直接跳到步骤 6（启动 Server）
3. **不存在** → 从步骤 1 开始执行完整流程

## 步骤 1：检测 IDE 适配器

根据项目中已有的 IDE 配置目录自动推断适配器类型：

| 检测条件 | 适配器 |
|----------|--------|
| 存在 `.cursor/` 目录 | `cursor` |
| 存在 `.claude/` 目录 | `claude-code` |
| 存在 `.codex/` 目录 | `codex` |
| 都不存在 | 询问用户选择 |

将检测结果记为 `ADAPTER`，后续步骤使用此变量。

## 步骤 2：扫描项目上下文

运行扫描脚本获取项目技术栈信息：

```bash
npx tsx <ai-pipeline-pkg>/scripts/scan-project.ts <project-root>
```

> `<ai-pipeline-pkg>` 是 ai-pipeline 包的安装路径，可通过 `npm list -g @toheart/ai-pipeline` 或在 node_modules 中定位。
> 如果脚本不可用，手动执行等价操作：检测 go.mod/package.json 推断技术栈、扫描目录结构、读取 OpenSpec 配置。

向用户展示扫描结果（技术栈、项目类型、目录结构），确认无误后继续。

## 步骤 3：部署脚手架

运行脚手架脚本创建 IDE 配置目录和 Hook：

```bash
npx tsx <ai-pipeline-pkg>/scripts/scaffold.ts <ADAPTER> <project-root>
```

此步骤是确定性操作，创建的内容包括：
- `.pipeline/` 目录和 ESM marker
- Agent 定义目录
- Hook 脚本和配置
- Manifest 和 Skill 目录
- 全局配置追加（CLAUDE.md / AGENTS.md）

## 步骤 4：生成 Agent 定义

运行 Agent 生成脚本：

```bash
npx tsx <ai-pipeline-pkg>/scripts/generate-agents.ts <ADAPTER> <project-root>
```

此步骤根据步骤 2 的扫描结果，生成项目特定的 Agent 定义文件：
- `explorer.md` — 项目探索与需求分析
- `go-implementer.md` / `frontend-implementer.md` — 实现专家（根据项目类型裁剪）
- `reviewer.md` — 代码审查
- `qa-tester.md` — 测试设计与执行（注入测试分层指导）

向用户展示生成的 Agent 列表，建议检查和调整。

**Agent 定义编写参考**：如需手动调整 Agent 定义，读取 `references/agent-patterns.md`。

## 步骤 5：生成 Orchestrator Skill

首先确保 `.pipeline/feature.ts` 存在（步骤 4 应已生成）。然后运行：

```bash
npx tsx <ai-pipeline-pkg>/scripts/generate-orchestrator.ts --adapter <ADAPTER>
```

此步骤将 `.pipeline/feature.ts` 编译为：
- `<config>/manifests/feature.manifest.json` — 机器可读的流水线描述
- `<config>/skills/orchestrator-feature/SKILL.md` — AI 可读的编排指令

**流水线模板参考**：如需了解模板设计，读取 `references/pipeline-patterns.md`。

## 步骤 6：启动 Pipeline Server

```bash
npx ai-pipeline serve
```

Dashboard 访问地址：`http://127.0.0.1:19090/`

**Server API 参考**：如需了解 API 端点，读取 `references/server-api.md`。

## 步骤 7：验证

1. 确认 Dashboard 可访问
2. 确认流水线模板已加载（`GET /api/v1/pipeline/templates`）
3. 向用户展示下一步操作：
   - 触发 `orchestrator-feature` Skill 开始第一条流水线
   - 或说"开始流水线""启动编排"

## 约束

- 步骤 2-5 只在首次初始化时执行，已有 orchestrator Skill 时跳过
- 脚本不可用时，按照脚本的等价逻辑手动执行（读取源码理解逻辑）
- 中文沟通，技术术语保留英文
- 每个步骤完成后简要汇报进度

## References 导航

| 文件 | 何时读取 |
|------|----------|
| `references/agent-patterns.md` | 手动调整 Agent 定义时 |
| `references/pipeline-patterns.md` | 自定义流水线模板时 |
| `references/adapter-guide.md` | 切换 IDE 或排查 Hook 问题时 |
| `references/server-api.md` | 操作 Pipeline Server API 时 |
| `references/testing/test-architecture.md` | 设计测试策略时 |
