# AI Pipeline

跨 IDE 的 AI 编排 SDK —— 用 TypeScript 或 YAML 定义 AI Agent 流水线。

## 核心思想

Pipeline 只管 **4 件事**：阶段顺序、角色分配、数据传递、暂停点。

Agent 的 prompt / skill / MCP 由 Agent 定义文件和 IDE 自行管理。Pipeline 是调度员，不是教练。

## 安装

```bash
npm install -D @toheart/ai-pipeline
```

## 快速开始

### 1. 初始化项目

```bash
npx ai-pipeline init cursor       # Cursor IDE
npx ai-pipeline init claude-code   # Claude Code
npx ai-pipeline init codex         # Codex
```

### 2. 定义流水线

```typescript
// .pipeline/feature.ts
import { pipeline, stage, gate, parallel } from "@toheart/ai-pipeline";

export default pipeline("feature", async (ctx) => {
  await stage("explore", { agent: "explorer" });
  await stage("propose", { skill: "openspec-propose" });
  await gate("确认方案设计");

  await parallel(
    stage("backend", { agent: "backend-implementer", scope: "backend/" }),
    stage("frontend", { agent: "frontend-implementer", scope: "frontend/" }),
  );

  await gate("确认代码质量");
  await stage("qa-test", { agent: "qa-tester" });
  await stage("archive", { skill: "openspec-archive" });
});
```

### 3. 编译

```bash
npx ai-pipeline generate                          # 默认 Cursor adapter
npx ai-pipeline generate --adapter claude-code     # Claude Code
npx ai-pipeline generate --adapter codex           # Codex
```

产出目录根据 adapter 动态分叉：

| Adapter | Manifests | Skills | Agent 定义 |
|---------|-----------|--------|-----------|
| cursor | `.cursor/manifests/` | `.cursor/skills/` | `.cursor/agents/*.md` |
| claude-code | `.claude/manifests/` | `.claude/skills/` | `.claude/agents/*.md` (frontmatter) |
| codex | `.codex/manifests/` | `.codex/skills/` | `.codex/agents/*.toml` |

### 4. 启动看板

```bash
npx ai-pipeline serve              # 默认端口 19090
npx ai-pipeline serve --port 8080  # 指定端口
```

打开 `http://127.0.0.1:19090/` 查看 Dashboard。

### 5. 查看状态

```bash
npx ai-pipeline status
```

## CLI 命令

| 命令 | 说明 |
|------|------|
| `ai-pipeline init <adapter>` | 初始化项目（生成 hooks.json、模板等） |
| `ai-pipeline generate [file]` | 编译 pipeline 定义 → manifest + skill |
| `ai-pipeline serve [--port]` | 启动 Server + Dashboard |
| `ai-pipeline status` | 查看当前 pipeline 实例状态 |

## 架构

```
ai-pipeline/
├── bin/                     CLI 入口 + 子命令
├── src/
│   ├── sdk/                 pipeline() / stage() / gate() / parallel()
│   ├── engine/              平台无关的状态机 + 模板加载
│   ├── server/              REST API + WebSocket
│   ├── adapters/            IDE 适配器（Cursor / Claude Code / Codex）
│   │   ├── paths.ts         统一路径映射（各 adapter 的目录约定）
│   │   ├── cursor/          Cursor adapter（Task tool + hooks.json）
│   │   ├── claude-code/     Claude Code adapter（Agent tool + CLAUDE.md）
│   │   └── codex/           Codex adapter（spawn agent + AGENTS.md）
│   └── generator/           Manifest + Orchestrator Skill 生成器
├── spec/                    语言规范 + Runtime 接口
├── templates/               YAML 编排模板
├── examples/                TypeScript SDK 示例
├── dashboard/               React Dashboard（Vite + Tailwind）
└── docs/                    项目文档（不随 npm 发布）

用户项目（init 后按 adapter 动态生成）
├── .pipeline/*.ts                TypeScript SDK 定义
├── .cursor/ 或 .claude/ 或 .codex/
│   ├── agents/                   Agent 定义（格式因平台而异）
│   ├── manifests/                编译产出
│   ├── skills/orchestrator-*/    生成的 Orchestrator Skill
│   ├── hooks/                    Hook 脚本 + 状态
│   └── pipelines/                编排模板副本
├── CLAUDE.md                     Claude Code 全局配置（含 pipeline 章节）
└── AGENTS.md                     Codex 全局配置（含 pipeline 章节）
```

## Dashboard 功能

- **流水线选择器** — 多 pipeline 实例管理
- **阶段进度条** — 实时状态（pending / active / completed / failed）
- **时间轴视图** — 甘特图式横向时间轴
- **Gate 面板** — 在看板上直接 Approve / Request Changes
- **Agent 面板** — 活跃 / 已完成 Agent 一览
- **审计日志** — 事件时间线

## YAML 模板（简单场景）

```yaml
name: go-backend-only
description: Go 纯后端编排模板

stages:
  - name: explore
    agent: explorer
  - name: propose
    skill: openspec-propose
  - name: gate1
    gate: true
    gate_description: "确认方案设计"
  - name: implement
    agent: backend-implementer
  - name: qa-test
    agent: qa-tester
  - name: archive
    skill: openspec-archive
```

## 开发

```bash
# Dashboard 开发模式（热更新）
cd dashboard && npm run dev

# 构建 Dashboard
cd dashboard && npm run build

# 运行测试
npm test
```

## 前置依赖

- Node.js >= 18
- `jq`（Hook 脚本使用，可选）

## 从 cursor-pipeline 迁移

ai-pipeline 是 [cursor-pipeline](https://github.com/toheart/cursor-pipeline) 的下一代版本。核心变化：

- 状态机从 Server 分离为纯函数（`engine/state-machine.ts`）
- Cursor 专属逻辑移入 `adapters/cursor/`
- 新增 TypeScript SDK，支持条件分支、循环、错误处理
- 新增 Manifest 机制，看板读 JSON 而不读 YAML
- **改为 npm 包安装**，不再需要克隆仓库
- **React Dashboard** 替代单文件 HTML，新增时间轴和 Gate 交互
- CLI 工具：`init` / `generate` / `serve` / `status`

## License

MIT
