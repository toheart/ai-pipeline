/**
 * parallel() —— 并行执行多个 stage
 *
 * dry-run 模式下收集并行 stage 的声明
 * 实际执行时 AI Agent 在同一条消息中发起多个 Task tool
 */

import type { StageResult } from "./sdk-types.ts";
import { isDryRun, registerStage } from "./registry.ts";

export function parallel(...results: StageResult[]): StageResult[] {
  if (isDryRun() && results.length > 0) {
    const agents = results
      .map((r) => r.name)
      .filter(Boolean);

    if (agents.length > 1) {
      registerStage({
        name: `parallel-${agents.join("-")}`,
        parallel: agents,
      });
    }
  }

  return results;
}
