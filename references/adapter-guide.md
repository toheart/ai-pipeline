# IDE 适配器指南

AI Pipeline 通过适配器层抽象不同 IDE 的差异。本文档说明三种适配器的配置目录、Agent 调度方式和 Hook 机制。

## 适配器对照表

| 项目 | Cursor | Claude Code | Codex |
|------|--------|-------------|-------|
| 配置根目录 | `.cursor/` | `.claude/` | `.codex/` |
| Agent 目录 | `.cursor/agents/` | `.claude/agents/` | `.codex/agents/` |
| Agent 文件格式 | `.md` | `.md`（YAML frontmatter） | `.toml` |
| Skill 目录 | `.cursor/skills/` | `.claude/skills/` | `.codex/skills/` |
| Hook 配置 | `.cursor/hooks.json` | `.claude/settings.json` | `.codex/hooks.json` |
| Hook 脚本目录 | `.cursor/hooks/` | `.claude/hooks/` | `.codex/hooks/` |
| 全局配置 | `.cursor/rules/` | `CLAUDE.md` | `AGENTS.md` |
| Agent 调度工具 | `Task tool` | `Agent tool` | `spawn agent` |
| 状态目录 | `.cursor/hooks/state/` | `.claude/hooks/state/` | `.codex/hooks/state/` |

## Agent 调度方式

### Cursor — Task tool

```
Task tool:
  description: "[pipeline:<id>] explorer: 执行 explore 阶段"
  prompt: "操作前必须先读取 .cursor/agents/explorer.md 并严格遵循..."
```

Cursor 的 SubAgent 通过 Task tool 派遣，需要在 prompt 中显式注入 Agent 定义文件的读取指令。

### Claude Code — Agent tool

```
Agent tool:
  agent_type: "explorer"
  prompt: "[pipeline:<id>] <任务描述>"
```

Claude Code 会自动加载 `.claude/agents/explorer.md` 中的 frontmatter 定义。

### Codex — spawn agent

```
spawn explorer agent "[pipeline:<id>] <任务描述>"
```

Codex 自动匹配 `.codex/agents/explorer.toml` 中的自定义 Agent。

## Hook 机制

### 事件类型

| 事件 | 触发时机 | 用途 |
|------|----------|------|
| `session-start` | Agent 会话开始 | 注入流水线上下文 |
| `pre-tool-use` | 工具调用前 | 权限检查、日志记录 |
| `post-tool-use` | 工具调用后 | 状态上报到 Pipeline Server |
| `stop` | 会话结束 | 清理、状态归档 |
| `permission-request` | 权限请求（Codex） | 自动批准或拒绝 |

### Hook 脚本通信

Hook 脚本通过 stdin 接收 JSON 事件，通过 stdout 返回 JSON 响应。Pipeline Server 的 API 端点（`http://127.0.0.1:19090/api/v1/...`）用于状态上报。

## 适配器选择指南

| 场景 | 推荐适配器 |
|------|-----------|
| 日常开发（IDE 内） | Cursor |
| CI/CD 自动化 | Claude Code / Codex |
| 多 Agent 并行 | Cursor（Task tool 支持并行） |
| 安全沙箱需求 | Codex（sandbox_mode） |
