/**
 * pipeline() —— 定义一条流水线
 *
 * 实际执行模式：注册 pipeline 定义，由外部 Runner 驱动执行
 * dry-run 模式：收集 stage 声明到 Registry，产出 Manifest
 */

import type { PipelineDef, PipelineFn, PipelineContext } from "./sdk-types.ts";
import { beginPipeline, endPipeline, isDryRun } from "./registry.ts";
import type { PipelineRuntime } from "../../spec/runtime-interface.ts";

const registeredPipelines = new Map<string, PipelineDef>();

export function pipeline(name: string, fn: PipelineFn): PipelineDef {
  const def: PipelineDef = { name, fn };
  registeredPipelines.set(name, def);
  return def;
}

/**
 * 在 dry-run 模式下执行 pipeline 定义，收集阶段声明
 * gate() 和条件分支中的动态内容会被跳过
 */
export async function dryRunPipeline(def: PipelineDef): Promise<void> {
  beginPipeline(def.name);
  try {
    const mockCtx: PipelineContext = {
      id: `${def.name}--dry-run`,
      changeName: "dry-run",
      runtime: createNoopRuntime(),
    };
    await def.fn(mockCtx);
  } catch {
    // dry-run 中条件分支可能因缺少真实数据而抛错，这是预期行为
  } finally {
    endPipeline();
  }
}

export function getPipelineDef(name: string): PipelineDef | undefined {
  return registeredPipelines.get(name);
}

export function listPipelineDefs(): PipelineDef[] {
  return [...registeredPipelines.values()];
}

function createNoopRuntime(): PipelineRuntime {
  return {
    name: "dry-run",
    async spawnAgent() {
      return { status: "completed", duration_ms: 0 };
    },
    async presentGate() {
      return { action: "approve" };
    },
    async reportStatus() {},
    async listAvailableAgents() {
      return [];
    },
    supportsParallel() {
      return true;
    },
  };
}
