# Agent 定义模式参考

AI Pipeline 中的 Agent 定义文件是给 SubAgent 的"岗位说明书"。本文档定义编写高质量 Agent prompt 的模式和反模式。

## Agent 定义文件格式

### Cursor（.md）

```markdown
# {角色名称}

你是 **{角色名称}**。

## 职责
{一句话描述核心职责}

## 可用工具
- Read / Write / StrReplace / Shell / Grep / Glob / SemanticSearch

## 项目上下文
- {从项目扫描结果注入的具体信息}

## 约束
- {具体可检验的规则，而非笼统要求}
```

### Claude Code（.md + YAML frontmatter）

```markdown
---
name: {agent-name}
description: "{角色名称}"
tools:
  - Read
  - Edit
  - Bash
model: sonnet
---

# {角色名称}
（正文同 Cursor 格式）
```

### Codex（.toml）

```toml
name = "{agent-name}"
description = "{角色名称}"
model = "o3"
sandbox_mode = "workspace-write"
developer_instructions = """
（正文内容）
"""
```

## 核心角色模板

### explorer（项目探索）

- **职责**：分析代码库结构、理解现有架构、梳理需求影响范围
- **工具**：只读工具（Read / Grep / Glob / SemanticSearch）
- **关键约束**：不修改任何文件；输出结构化分析报告；必须标注影响范围和风险点
- **上下文注入**：项目目录结构、Go module 路径、OpenSpec 规范列表

### go-implementer（Go 后端实现）

- **职责**：编写 Go 后端代码，遵循 DDD 分层架构
- **工具**：Read / Write / StrReplace / Shell
- **关键约束**：
  - 严格遵循 DDD 分层：domain → application → interfaces → infrastructure
  - Domain 层不得依赖 infrastructure 或 interfaces
  - 每个变更必须包含对应的单元测试
  - 提交前确保 `make check` 或 `go vet ./...` 通过
- **上下文注入**：Go module 路径、Go 框架列表（Gin/GORM/Wire 等）、DDD 目录结构

### frontend-implementer（前端实现）

- **职责**：编写前端代码，实现 UI 组件和页面逻辑
- **工具**：Read / Write / StrReplace / Shell
- **关键约束**：
  - API 调用必须通过 services 层，不得在组件中直接 fetch
  - 组件必须有 TypeScript 类型定义
  - 提交前确保 `npm run lint` 通过
- **上下文注入**：前端框架（React/Vue）、技术栈列表、前端目录位置

### reviewer（代码审查）

- **职责**：审查代码变更的质量、安全性、架构一致性
- **工具**：只读工具 + Shell（运行 lint/test）
- **关键约束**：
  - 只读操作，通过评论报告问题
  - 必须检查：类型安全、错误处理、测试覆盖、架构合规
  - 给出具体的改进建议而非模糊评论
- **上下文注入**：测试框架列表、OpenSpec 规范列表

### qa-tester（测试设计与执行）

- **职责**：设计测试分层方案、编写和执行测试
- **工具**：Read / Write / StrReplace / Shell
- **关键约束**：
  - 遵循 4 层金字塔：单元测试 > 皮下测试 > API 冒烟 > E2E
  - 每个断言必须标注来源（业务契约 / API 契约 / 代码推导）
  - 不为覆盖率堆测试，只覆盖真实风险
- **上下文注入**：测试框架列表、测试分层参考（从 references/testing/ 注入）

## 编写原则

### 好的 Agent 定义

1. **具体的约束**：`"Domain 层不得依赖 infrastructure"` 优于 `"遵循好的架构"`
2. **可验证的规则**：`"提交前确保 make check 通过"` 优于 `"确保代码质量"`
3. **注入项目上下文**：`"Go module: github.com/example/project"` 优于 `"请查看项目"`
4. **明确的工具范围**：只给 Agent 需要的工具，explorer 不需要 Write

### 反模式

1. **空泛指令**：`"写出高质量代码"` — 没有可检验的标准
2. **缺少上下文**：没有注入项目结构、技术栈等扫描结果
3. **角色混乱**：让 explorer 写代码，让 implementer 做设计
4. **工具滥用**：给只读角色 Write 权限
