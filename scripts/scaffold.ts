#!/usr/bin/env tsx
/**
 * 项目脚手架脚本
 *
 * 在目标项目中创建 AI Pipeline 所需的目录结构和配置文件，
 * 包括：IDE 配置目录、hooks 部署、ESM marker 等。
 *
 * 用法：
 *   tsx scripts/scaffold.ts <adapter> [projectRoot]
 *
 * 参数：
 *   adapter      IDE 适配器名称：cursor | claude-code | codex
 *   projectRoot  目标项目根目录，默认为 cwd
 */

import { existsSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getAdapterPaths, isValidAdapter, VALID_ADAPTERS, type AdapterName } from "../src/adapters/paths.ts";

function getPackageRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..");
}

function ensureDir(projectRoot: string, dir: string): boolean {
  const p = join(projectRoot, dir);
  if (!existsSync(p)) {
    mkdirSync(p, { recursive: true });
    console.log(`  created ${dir}/`);
    return true;
  }
  return false;
}

export function scaffold(adapter: AdapterName, projectRoot: string): void {
  const paths = getAdapterPaths(adapter);
  const pkgRoot = getPackageRoot();
  const adapterDir = join(pkgRoot, "src", "adapters", adapter);

  if (!existsSync(adapterDir)) {
    console.error(`Adapter not found: ${adapterDir}`);
    process.exit(1);
  }

  // 创建目录
  const dirs = [
    ".pipeline",
    paths.agentsDir,
    paths.manifestsDir,
    paths.skillsDir,
    paths.hooksDir,
    paths.stateDir,
    paths.pipelinesDir,
  ];
  for (const d of dirs) {
    ensureDir(projectRoot, d);
  }

  // 部署 hooks 配置（使用相对路径）
  const hooksTpl = join(adapterDir, "hooks.json.tpl");
  if (existsSync(hooksTpl)) {
    const content = readFileSync(hooksTpl, "utf-8");
    const target = join(projectRoot, paths.hooksConfig);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
    console.log(`  deployed ${paths.hooksConfig}`);
  }

  // 部署 hook 脚本
  const hookScriptsDir = join(adapterDir, "hook-scripts");
  if (existsSync(hookScriptsDir)) {
    const targetDir = join(projectRoot, paths.hooksDir);
    mkdirSync(targetDir, { recursive: true });
    for (const f of readdirSync(hookScriptsDir)) {
      copyFileSync(join(hookScriptsDir, f), join(targetDir, f));
      console.log(`  deployed ${paths.hooksDir}/${f}`);
    }
  }

  // Cursor 专属脚本
  if (adapter === "cursor") {
    for (const script of ["forward-hook.sh", "auto-format.sh"]) {
      const src = join(adapterDir, script);
      if (existsSync(src)) {
        const target = join(projectRoot, paths.hooksDir, script);
        copyFileSync(src, target);
        console.log(`  deployed ${paths.hooksDir}/${script}`);
      }
    }
  }

  // 确保 .pipeline/ 目录被 Node 识别为 ESM 模块
  const pipelinePkg = join(projectRoot, ".pipeline", "package.json");
  if (!existsSync(pipelinePkg)) {
    writeFileSync(pipelinePkg, JSON.stringify({ type: "module" }, null, 2) + "\n");
    console.log("  created .pipeline/package.json (ESM marker)");
  }

  // 追加全局配置（CLAUDE.md / AGENTS.md）
  if (adapter === "claude-code") {
    appendGlobalConfig(projectRoot, "CLAUDE.md", adapter, paths);
  } else if (adapter === "codex") {
    appendGlobalConfig(projectRoot, "AGENTS.md", adapter, paths);
  }
}

function generateGlobalConfigSection(adapter: AdapterName, paths: ReturnType<typeof getAdapterPaths>): string {
  return [
    ``,
    `## AI Pipeline 编排`,
    ``,
    `本项目使用 [ai-pipeline](https://github.com/toheart/ai-pipeline) 进行 AI 开发流水线编排。`,
    ``,
    `- 流水线定义：\`.pipeline/*.ts\``,
    `- Agent 定义：\`${paths.agentsDir}/*${paths.agentFileExt}\``,
    `- 编排器 Skill：\`${paths.skillsDir}/orchestrator-*/SKILL.md\``,
    `- Dashboard：\`http://127.0.0.1:19090/\``,
    ``,
    `### 常用命令`,
    ``,
    `\`\`\`bash`,
    `npx ai-pipeline serve   # 启动看板`,
    `\`\`\``,
    ``,
  ].join("\n");
}

function appendGlobalConfig(
  projectRoot: string,
  filename: string,
  adapter: AdapterName,
  paths: ReturnType<typeof getAdapterPaths>,
): void {
  const filePath = join(projectRoot, filename);
  const section = generateGlobalConfigSection(adapter, paths);
  if (existsSync(filePath)) {
    const content = readFileSync(filePath, "utf-8");
    if (!content.includes("AI Pipeline 编排")) {
      writeFileSync(filePath, content + section);
      console.log(`  updated ${filename} (appended pipeline section)`);
    }
  } else {
    writeFileSync(filePath, `# Project Guide\n${section}`);
    console.log(`  created ${filename}`);
  }
}

// CLI 入口
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("scaffold.ts")) {
  const adapter = process.argv[2] as AdapterName;
  if (!adapter || !isValidAdapter(adapter)) {
    console.error(`Usage: tsx scripts/scaffold.ts <${VALID_ADAPTERS.join("|")}> [projectRoot]`);
    process.exit(1);
  }
  const projectRoot = resolve(process.argv[3] ?? process.cwd());
  scaffold(adapter, projectRoot);
}
