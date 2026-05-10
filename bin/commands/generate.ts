/**
 * ai-pipeline generate [file] [--adapter] — 编译 pipeline 定义
 *
 * 扫描 .pipeline/*.ts 或指定文件，产出 manifest.json + orchestrator SKILL.md
 * 输出目录根据 --adapter 动态分叉到对应 IDE 的配置目录。
 */

import { resolve, basename, join } from "node:path";
import { pathToFileURL } from "node:url";
import { writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { parseArgs } from "node:util";

export async function runGenerate(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      adapter: { type: "string", default: "cursor" },
      "output-dir": { type: "string" },
    },
    strict: false,
    allowPositionals: true,
  });

  const adapter = (values.adapter as string) ?? "cursor";

  const { isValidAdapter, getAdapterPaths } = await import("../../src/adapters/paths.ts");
  if (!isValidAdapter(adapter)) {
    console.error(`Unknown adapter: ${adapter}. Valid: cursor, claude-code, codex`);
    process.exit(1);
  }

  const adapterPaths = getAdapterPaths(adapter);
  const manifestsDir = resolve(values["output-dir"] as string ?? adapterPaths.manifestsDir);
  const skillsDir = resolve(adapterPaths.skillsDir);

  let sourceFiles: string[] = [];
  if (positionals.length > 0) {
    sourceFiles = positionals.map((f) => resolve(f));
  } else {
    const pipelineDir = resolve(".pipeline");
    if (existsSync(pipelineDir)) {
      sourceFiles = readdirSync(pipelineDir)
        .filter((f) => f.endsWith(".ts"))
        .map((f) => join(pipelineDir, f));
    }
  }

  if (sourceFiles.length === 0) {
    console.error("No pipeline files found. Create .pipeline/*.ts or specify a file.");
    process.exit(1);
  }

  console.log(`Generating for adapter: ${adapter}`);
  console.log(`Sources: ${sourceFiles.map((f) => basename(f)).join(", ")}`);

  // 先导入用户的 pipeline 文件（会触发 ai-pipeline 包中 SDK 的注册逻辑）
  // 然后再导入 SDK 工具进行后续处理
  for (const sourceFile of sourceFiles) {
    await import(pathToFileURL(sourceFile).href);
  }

  const { getRegistry } = await import("../../src/sdk/registry.ts");
  const { dryRunPipeline, listPipelineDefs } = await import("../../src/sdk/pipeline.ts");
  const { generateOrchestratorSkill } = await import("../../src/generator/skill-generator.ts");

  const registry = getRegistry();
  registry.enableDryRun();

  const defs = listPipelineDefs();
  if (defs.length === 0) {
    console.warn("No pipeline definitions found.");
    return;
  }

  for (const def of defs) {
    await dryRunPipeline(def);

    const meta = registry.getMeta(def.name);
    if (!meta) {
      console.error(`Failed to get meta for pipeline: ${def.name}`);
      continue;
    }

    const manifest: any = {
      name: meta.name,
      version: "1.0.0",
      stages: meta.stages.map(
        (s: any) => ({
          name: s.name,
          agent: s.agent,
          skill: s.skill,
          gate: s.gate,
          gate_description: s.gateDescription,
          optional: s.optional,
          parallel: s.parallel,
          on_fail: s.onFail,
        }),
      ),
      conditionals: [],
      loops: [],
      agents: meta.agents,
      source: sourceFiles.join(", "),
    };

    mkdirSync(manifestsDir, { recursive: true });
    const manifestPath = join(manifestsDir, `${def.name}.manifest.json`);
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`  manifest: ${manifestPath}`);

    const skillDir = join(skillsDir, `orchestrator-${def.name}`);
    mkdirSync(skillDir, { recursive: true });
    const skillContent = generateOrchestratorSkill(manifest, adapter);
    const skillPath = join(skillDir, "SKILL.md");
    writeFileSync(skillPath, skillContent);
    console.log(`  skill:    ${skillPath}`);

    console.log(`  pipeline "${def.name}": ${manifest.stages.length} stages, ${manifest.agents.length} agents`);
  }

  registry.reset();
  console.log("\nDone!");
}
