/**
 * ai-pipeline generate [file] [--adapter] — 编译 pipeline 定义
 *
 * 扫描 .pipeline/*.ts 或指定文件，产出 manifest.json + orchestrator SKILL.md
 * 输出目录根据 --adapter 动态分叉到对应 IDE 的配置目录。
 */

import { resolve, basename, dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { getRegistry } from "../../src/sdk/registry.ts";
import { dryRunPipeline, listPipelineDefs } from "../../src/sdk/pipeline.ts";
import type { PipelineManifest, ManifestStageDef } from "../../src/engine/types.ts";
import { generateOrchestratorSkill } from "../../src/generator/skill-generator.ts";
import { getAdapterPaths, isValidAdapter } from "../../src/adapters/paths.ts";

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
  if (!isValidAdapter(adapter)) {
    console.error(`Unknown adapter: ${adapter}. Valid: cursor, claude-code, codex`);
    process.exit(1);
  }

  const adapterPaths = getAdapterPaths(adapter);
  const projectRoot = process.cwd();
  const manifestsDir = resolve(values["output-dir"] as string ?? adapterPaths.manifestsDir);
  const skillsDir = resolve(adapterPaths.skillsDir);

  // 发现 pipeline 文件
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

  const registry = getRegistry();

  for (const sourceFile of sourceFiles) {
    registry.enableDryRun();

    await import(pathToFileURL(sourceFile).href);

    const defs = listPipelineDefs();
    if (defs.length === 0) {
      console.warn(`No pipeline definitions found in ${basename(sourceFile)}`);
      continue;
    }

    for (const def of defs) {
      await dryRunPipeline(def);

      const meta = registry.getMeta(def.name);
      if (!meta) {
        console.error(`Failed to get meta for pipeline: ${def.name}`);
        continue;
      }

      // 生成 Manifest
      const manifest: PipelineManifest = {
        name: meta.name,
        version: "1.0.0",
        stages: meta.stages.map(
          (s): ManifestStageDef => ({
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
        source: sourceFile,
      };

      mkdirSync(manifestsDir, { recursive: true });
      const manifestPath = join(manifestsDir, `${def.name}.manifest.json`);
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      console.log(`  manifest: ${manifestPath}`);

      // 生成 Orchestrator Skill
      const skillDir = join(skillsDir, `orchestrator-${def.name}`);
      mkdirSync(skillDir, { recursive: true });
      const skillContent = generateOrchestratorSkill(manifest, adapter);
      const skillPath = join(skillDir, "SKILL.md");
      writeFileSync(skillPath, skillContent);
      console.log(`  skill:    ${skillPath}`);

      console.log(`  pipeline "${def.name}": ${manifest.stages.length} stages, ${manifest.agents.length} agents`);
    }

    registry.reset();
  }

  console.log("\nDone!");
}
