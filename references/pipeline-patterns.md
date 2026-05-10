# 流水线模板模式参考

AI Pipeline 使用 YAML 模板定义流水线阶段。本文档描述内置模板的设计模式和自定义指南。

## 四种阶段类型

| 类型 | 关键字段 | 执行方式 | 状态上报 |
|------|----------|----------|----------|
| Agent Stage | `agent: <name>` | 委托给 SubAgent 执行 | Hook 自动上报（Cursor）或手动 curl |
| Skill Stage | `skill: <name>` | 主 Agent 直接执行 | 必须手动 curl 上报 |
| Gate Stage | `gate: true` | 暂停等待用户确认 | 用户选择后 curl 上报 |
| Parallel Stage | `parallel: [...]` | 多个 SubAgent 并行 | 全部完成后 curl 上报 |

## 内置模板

### go-backend-only

纯后端顺序流水线，9 个阶段：

```
explore → propose → review → [确认方案设计] → implement → code-review → [确认代码质量] → integration-test → archive
```

适用场景：Go 纯后端项目，单人或小团队，无前端。

### go-react-fullstack

全栈并行流水线，11 个阶段：

```
explore → propose → review → [确认方案设计] → implement(BE ∥ FE) → code-review(BE ∥ FE) → [确认代码质量] → qa-test → [确认测试结果] → integration-test → archive
```

适用场景：Go + React 全栈项目，前后端并行实现和审查。

### node-fullstack

Node.js + React 全栈并行流水线，结构与 go-react-fullstack 相同，变量不同（`server/` / `client/`）。

## YAML 模板格式

```yaml
name: template-name
description: 模板描述

variables:
  project_name: my-project
  backend_dir: backend/
  frontend_dir: frontend/

stages:
  - name: stage-name        # 唯一标识（kebab-case）
    label: Display Name      # 显示名称
    agent: agent-name        # Agent Stage
    skill: skill-name        # Skill Stage
    gate: true               # Gate Stage
    gate_description: "..."  # Gate 说明
    optional: true           # 可跳过
    parallel:                # Parallel Stage
      - agent: be-impl
        scope: "..."
      - agent: fe-impl
        scope: "..."
```

## 自定义指南

### 何时该用 Gate

- 方案设计完成后（防止方向错误的实现）
- 代码审查完成后（防止低质量代码合入）
- 测试完成后（确认测试结果可接受）

Gate 是**人类控制点**，12 步流水线通常只需要 2-3 个 Gate。

### 何时该用 Parallel

- 前后端可以独立实现时
- 多个审查可以同时进行时
- 多个独立测试套件可以并行时

### 何时该用 Skill vs Agent

- **Skill**：主 Agent 直接执行的流程（如 openspec-propose、openspec-archive），不需要独立上下文
- **Agent**：需要独立上下文和专注领域的任务（如 go-implementer、frontend-implementer）

## 从模板到 Orchestrator Skill

```
YAML 模板 → scripts/generate-orchestrator.ts → manifest.json + SKILL.md
```

`generate-orchestrator.ts` 的核心工作：
1. 加载 `.pipeline/*.ts` 中的 pipeline 定义
2. Dry-run 执行获取 stage 元数据
3. 为每个 stage 生成对应的 IDE 适配指令（Cursor Task tool / Claude Code Agent tool / Codex spawn）
4. 输出 manifest.json（机器读）和 SKILL.md（AI 读）
