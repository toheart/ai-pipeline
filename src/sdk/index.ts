/**
 * AI Pipeline SDK —— 用 TypeScript 定义 AI Agent 流水线
 *
 * 四个核心原语：
 * - pipeline()  定义一条流水线（main 函数）
 * - stage()     声明一个执行阶段（函数调用）
 * - gate()      人工检查点（await / 断言）
 * - parallel()  并行执行（Promise.all）
 */

export { pipeline } from "./pipeline.ts";
export { stage } from "./stage.ts";
export { gate } from "./gate.ts";
export { parallel } from "./parallel.ts";
export { getRegistry, resetRegistry } from "./registry.ts";
export type { PipelineDef, PipelineContext, StageOpts, StageResult, GateOpts } from "./sdk-types.ts";
