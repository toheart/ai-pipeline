/**
 * SDK 层类型定义
 */

import type { PipelineRuntime } from "../../spec/runtime-interface.ts";

export interface StageOpts {
  /** 委托的 Agent 名称 */
  agent?: string;
  /** 调用的 Skill 名称（与 agent 互斥） */
  skill?: string;
  /** 任务描述（覆盖默认） */
  task?: string;
  /** 作用域限制（目录路径） */
  scope?: string;
  /** 传递给 Agent 的上下文数据 */
  input?: Record<string, unknown>;
  /** 是否可选 */
  optional?: boolean;
  /** 失败策略 */
  onFail?: "retry" | "skip" | "abort";
  /** 重试次数 */
  retries?: number;
}

export interface StageResult {
  name: string;
  status: "completed" | "failed" | "skipped";
  output: Record<string, unknown>;
  duration_ms: number;
}

export interface GateOpts {
  /** 自定义选项 */
  options?: string[];
  /** 超时毫秒数（超时自动 abort） */
  timeout_ms?: number;
}

export type GateResult = "approve" | "reject" | "abort";

export interface PipelineContext {
  /** 当前 pipeline 实例 ID */
  id: string;
  /** 变更名称 */
  changeName: string;
  /** 底层运行时适配器 */
  runtime: PipelineRuntime;
}

export type PipelineFn = (ctx: PipelineContext) => Promise<void>;

export interface PipelineDef {
  name: string;
  fn: PipelineFn;
}

/** Registry 在 dry-run 模式下收集的阶段信息 */
export interface RegisteredStage {
  name: string;
  agent?: string;
  skill?: string;
  gate?: boolean;
  gateDescription?: string;
  optional?: boolean;
  parallel?: string[];
  onFail?: string;
}

export interface RegistryMeta {
  name: string;
  stages: RegisteredStage[];
  hasConditionals: boolean;
  hasLoops: boolean;
  agents: string[];
  source?: string;
}
