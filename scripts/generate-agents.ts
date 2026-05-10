#!/usr/bin/env tsx
/**
 * Agent 定义生成脚本
 *
 * 根据项目上下文和 adapter 类型，
 * 生成 Agent 定义文件到目标项目的 agents 目录。
 *
 * 用法：
 *   tsx scripts/generate-agents.ts <adapter> [projectRoot]
 *
 * 参数：
 *   adapter      IDE 适配器名称：cursor | claude-code | codex
 *   projectRoot  目标项目根目录，默认为 cwd
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { isValidAdapter, getAdapterPaths, VALID_ADAPTERS, type AdapterName } from "../src/adapters/paths.ts";
import { scanProject } from "../src/scanner/project-scanner.ts";
import { generateAgents, type GeneratedAgent } from "../src/generator/agent-prompt.ts";

export function writeAgents(
  agents: GeneratedAgent[],
  agentsDir: string,
  projectRoot: string,
): { created: string[]; skipped: string[] } {
  const created: string[] = [];
  const skipped: string[] = [];
  const targetDir = join(projectRoot, agentsDir);
  mkdirSync(targetDir, { recursive: true });

  for (const agent of agents) {
    const agentFile = join(targetDir, agent.filename);
    if (!existsSync(agentFile)) {
      writeFileSync(agentFile, agent.content);
      console.log(`  created ${agentsDir}/${agent.filename}`);
      created.push(agent.filename);
    } else {
      console.log(`  skipped ${agentsDir}/${agent.filename} (already exists)`);
      skipped.push(agent.filename);
    }
  }

  return { created, skipped };
}

// CLI 入口
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("generate-agents.ts")) {
  const adapter = process.argv[2] as AdapterName;
  if (!adapter || !isValidAdapter(adapter)) {
    console.error(`Usage: tsx scripts/generate-agents.ts <${VALID_ADAPTERS.join("|")}> [projectRoot]`);
    process.exit(1);
  }

  const projectRoot = resolve(process.argv[3] ?? process.cwd());
  const paths = getAdapterPaths(adapter);

  const ctx = scanProject(projectRoot);

  const agents = generateAgents(ctx, adapter);
  const result = writeAgents(agents, paths.agentsDir, projectRoot);

  console.log(`\nAgent 生成完成: ${result.created.length} created, ${result.skipped.length} skipped`);
}
