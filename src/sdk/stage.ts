/**
 * stage() —— 声明一个执行阶段
 *
 * dry-run 模式下仅注册到 Registry，返回空结果
 * 实际执行时由 AI Agent 读取并通过 Runtime 驱动
 */

import type { StageOpts, StageResult } from "./sdk-types.ts";
import { isDryRun, registerStage } from "./registry.ts";

export function stage(name: string, opts: StageOpts = {}): StageResult {
  if (isDryRun()) {
    registerStage({
      name,
      agent: opts.agent,
      skill: opts.skill,
      optional: opts.optional,
      onFail: opts.onFail,
    });

    return {
      name,
      status: "completed",
      output: {},
      duration_ms: 0,
    };
  }

  /**
   * 非 dry-run 模式下，stage() 返回一个占位结果。
   *
   * 实际场景中 AI Agent 读取 pipeline 定义理解流程，
   * 然后通过 Task tool / curl 逐步执行。
   * stage() 的返回值在 AI 执行链路中作为数据传递的桥梁。
   */
  return {
    name,
    status: "completed",
    output: {},
    duration_ms: 0,
  };
}
