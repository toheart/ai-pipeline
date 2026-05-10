/**
 * Pipeline Registry —— dry-run 模式下收集 stage / gate / parallel 声明
 *
 * generate 命令"假装执行"pipeline 定义时，SDK 原语不真的跑 Agent，
 * 而是把调用记录注册到 Registry。生成器从 Registry 提取元信息产出 Manifest。
 */

import type { RegisteredStage, RegistryMeta } from "./sdk-types.ts";

interface PipelineRegistry {
  pipelines: Map<string, {
    stages: RegisteredStage[];
    agents: Set<string>;
  }>;
  currentPipeline: string | null;
  dryRun: boolean;
}

const registry: PipelineRegistry = {
  pipelines: new Map(),
  currentPipeline: null,
  dryRun: false,
};

export function enableDryRun(): void {
  registry.dryRun = true;
}

export function disableDryRun(): void {
  registry.dryRun = false;
}

export function isDryRun(): boolean {
  return registry.dryRun;
}

export function beginPipeline(name: string): void {
  registry.currentPipeline = name;
  if (!registry.pipelines.has(name)) {
    registry.pipelines.set(name, { stages: [], agents: new Set() });
  }
}

export function endPipeline(): void {
  registry.currentPipeline = null;
}

export function registerStage(stage: RegisteredStage): void {
  if (!registry.currentPipeline) return;
  const pipeline = registry.pipelines.get(registry.currentPipeline);
  if (!pipeline) return;

  pipeline.stages.push(stage);

  if (stage.agent) pipeline.agents.add(stage.agent);
  if (stage.parallel) {
    for (const a of stage.parallel) pipeline.agents.add(a);
  }
}

export function getMeta(name: string): RegistryMeta | null {
  const pipeline = registry.pipelines.get(name);
  if (!pipeline) return null;

  return {
    name,
    stages: pipeline.stages,
    hasConditionals: false,
    hasLoops: false,
    agents: [...pipeline.agents],
  };
}

export function getRegistry() {
  return {
    enableDryRun,
    disableDryRun,
    isDryRun,
    beginPipeline,
    endPipeline,
    registerStage,
    getMeta,
    reset: resetRegistry,
  };
}

export function resetRegistry(): void {
  registry.pipelines.clear();
  registry.currentPipeline = null;
  registry.dryRun = false;
}
