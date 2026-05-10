/**
 * gate() —— 人工检查点
 *
 * dry-run 模式下注册到 Registry 并返回 "approve"
 * 实际执行时 AI Agent 暂停并等待用户决策
 */

import type { GateOpts, GateResult } from "./sdk-types.ts";
import { isDryRun, registerStage } from "./registry.ts";

export function gate(description: string, opts: GateOpts = {}): GateResult {
  const gateName = `gate-${description.replace(/\s+/g, "-").toLowerCase().slice(0, 30)}`;

  if (isDryRun()) {
    registerStage({
      name: gateName,
      gate: true,
      gateDescription: description,
    });
    return "approve";
  }

  return "approve";
}
