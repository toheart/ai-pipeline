# AI Pipeline 语义规则

本文档定义 Pipeline 定义（YAML 或 TypeScript SDK）的执行语义。任何符合 Runtime Interface 的适配器，在执行同一份 Pipeline 定义时，都应产生一致的行为。

## 状态模型

### Pipeline 实例状态

```
idle → running → completed
                → failed
                → aborted（用户主动终止）
```

### Stage 状态

```
pending → active → completed
                 → failed → (retry → active | abort)
                 → skipped
```

### Gate 状态

```
pending → approved（通过）
        → rejected（退回）
        → aborted（放弃）
```

## 执行规则

### 顺序执行

1. Stages 按声明顺序执行
2. 前一个 stage 状态变为 `completed` 或 `skipped` 时，自动推进到下一个 stage
3. 任何 stage 状态变为 `failed` 且无 `onFail` 策略时，整个 pipeline 标记为 `failed`

### 并行执行

1. `parallel()` 内的所有 stage 同时启动
2. 所有并行 stage 都 `completed` 后，`parallel` 整体才标记为 `completed`
3. 并行 stage 中任一 `failed`：
   - `onFail: "retry"` → 仅重试失败的 stage，其余结果保留
   - `onFail: "skip"` → 跳过失败的 stage，其余继续
   - `onFail: "abort"` → 整个 parallel 标记为 `failed`
4. 如果 Runtime 不支持并行（`supportsParallel() === false`），降级为顺序执行

### Gate 规则

1. Gate stage 进入 `active` 时，暂停执行，等待人类决策
2. 决策选项：
   - `approve` → stage `completed`，继续后续
   - `reject` → 回退到指定 stage 重新执行（默认回退到前一个非 gate stage）
   - `abort` → 整个 pipeline 标记为 `aborted`
3. Gate 不能被自动跳过，必须等人类确认

### 条件分支（SDK 模式）

1. `if/else` 在 TypeScript 中是原生语法，Engine 不干预
2. AI Agent 读取 TypeScript 源码理解分支逻辑
3. Manifest 中标注"存在条件分支"及可能的路径，但不展开具体逻辑
4. State 记录实际走了哪条路径

### 循环（SDK 模式）

1. `while/for` 在 TypeScript 中是原生语法
2. Manifest 中标注循环点和建议的最大次数
3. State 记录实际循环次数
4. 每次循环产生的动态 stage 记录在 `runtime_stages` 中

## Agent 绑定规则

1. Stage 中的 `agent` 字段是逻辑名称，不是文件路径
2. 逻辑名称到实际 Agent 定义的映射，由 Runtime 适配器负责
3. Pipeline 不关心 Agent 内部的 prompt / skill / MCP 配置
4. Pipeline 传递给 Agent 的信息仅限：任务描述、scope、input 数据

## 数据流规则

1. `input` 字段声明 stage 的输入数据
2. `StageResult.output` 携带 stage 的产出数据
3. 后续 stage 可以通过前序 stage 的返回值访问 output
4. 在 YAML 模式下，数据通过文件系统隐式传递（无显式 input/output）

## Manifest 规则

1. Manifest 是 Pipeline 定义的编译时静态分析产物
2. Manifest 包含所有声明过的 stage / gate / parallel
3. 条件分支以"可能路径"标注，不展开具体逻辑
4. 循环以"循环点 + 最大次数"标注
5. Manifest 是 JSON 格式，可被 Server 和 Dashboard 直接消费
6. YAML 模板和 TypeScript SDK 都编译为相同格式的 Manifest
