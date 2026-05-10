/**
 * Pipeline Runtime Interface
 *
 * 任何 IDE 适配器必须实现此接口。
 * Pipeline Engine 通过此接口与具体 IDE 交互，实现跨平台可移植。
 */

export interface SpawnAgentOpts {
  /** Agent 逻辑名称（对应 agents/{name}.md） */
  agent: string;
  /** 任务描述 */
  task: string;
  /** Pipeline 实例 ID，用于事件路由 */
  pipelineId: string;
  /** 作用域限制（目录路径） */
  scope?: string;
  /** 传递给 Agent 的上下文数据 */
  input?: Record<string, unknown>;
}

export interface AgentResult {
  status: "completed" | "failed" | "aborted";
  /** Agent 产出的结构化数据 */
  output?: Record<string, unknown>;
  /** 摘要文本 */
  summary?: string;
  duration_ms: number;
}

export interface GateContext {
  /** Gate 所属的阶段名 */
  stageName: string;
  /** Gate 描述 */
  description: string;
  /** 上一阶段的结论摘要 */
  previousSummary?: string;
  /** 可选的自定义选项 */
  options?: string[];
}

export type GateDecision = {
  action: "approve" | "reject" | "abort";
  comment?: string;
  /** reject 时可指定回退到的阶段 */
  rejectTo?: string;
};

export interface StatusReport {
  pipelineId: string;
  stage: string;
  status: "active" | "completed" | "failed" | "skipped";
  timestamp: string;
  detail?: string;
}

export interface AgentMeta {
  name: string;
  description?: string;
  /** Agent 定义文件路径 */
  definitionPath?: string;
}

/**
 * Pipeline Runtime 抽象接口
 *
 * 每个 IDE 适配器实现此接口，将 Pipeline Engine 的抽象操作
 * 翻译为具体 IDE 的原生能力。
 */
export interface PipelineRuntime {
  /** 适配器标识 */
  readonly name: string;

  /** 启动一个 Agent 执行任务 */
  spawnAgent(opts: SpawnAgentOpts): Promise<AgentResult>;

  /** 呈现 Gate 检查点，等待人类决策 */
  presentGate(context: GateContext): Promise<GateDecision>;

  /** 上报阶段状态 */
  reportStatus(report: StatusReport): Promise<void>;

  /** 发现当前项目中可用的 Agent */
  listAvailableAgents(): Promise<AgentMeta[]>;

  /** 适配器是否支持并行执行 */
  supportsParallel(): boolean;
}
