/**
 * ai-pipeline init <adapter> — 初始化项目
 *
 * 两阶段初始化：
 *   Phase 1（程序自动）：目录创建、hooks 部署、模板复制等确定性工作
 *   Phase 2（上下文感知）：扫描项目技术栈，自动生成高质量 Agent 定义和 Pipeline 编排
 */

import { existsSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getAdapterPaths, isValidAdapter, VALID_ADAPTERS, type AdapterName } from "../../src/adapters/paths.ts";
import { scanProject, formatContextSummary } from "../../src/scanner/project-scanner.ts";
import { generateAgents, generatePipelineDefinition } from "../../src/generator/agent-prompt.ts";

function getPackageRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../..");
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

/**
 * 生成全局配置追加段落（CLAUDE.md / AGENTS.md）
 */
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
    `npx ai-pipeline generate --adapter ${adapter}   # 编译流水线`,
    `npx ai-pipeline serve                            # 启动看板`,
    `\`\`\``,
    ``,
  ].join("\n");
}

export async function runInit(args: string[]): Promise<void> {
  const adapter = args[0] as AdapterName;
  if (!adapter || !isValidAdapter(adapter)) {
    console.error(`Usage: ai-pipeline init <${VALID_ADAPTERS.join("|")}>`);
    process.exit(1);
  }

  const paths = getAdapterPaths(adapter);
  const projectRoot = process.cwd();
  const pkgRoot = getPackageRoot();

  // ═══════════════════════════════════════════════════
  // Phase 1: 项目上下文扫描
  // ═══════════════════════════════════════════════════
  console.log(`\n[1/3] 扫描项目上下文...\n`);
  const ctx = scanProject(projectRoot);
  console.log(formatContextSummary(ctx));

  // ═══════════════════════════════════════════════════
  // Phase 2: 目录和配置 scaffold（程序自动）
  // ═══════════════════════════════════════════════════
  console.log(`\n[2/3] 初始化 ${adapter} adapter 配置...\n`);

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

  // ═══════════════════════════════════════════════════
  // Phase 3: 基于项目上下文生成 Agent + Pipeline（AI 级别）
  // ═══════════════════════════════════════════════════
  console.log(`\n[3/3] 基于项目上下文生成 Agent 和 Pipeline...\n`);

  // 生成 Agent 定义——根据项目扫描结果自动裁剪角色和 prompt
  const agents = generateAgents(ctx, adapter);
  for (const agent of agents) {
    const agentFile = join(projectRoot, paths.agentsDir, agent.filename);
    if (!existsSync(agentFile)) {
      writeFileSync(agentFile, agent.content);
      console.log(`  created ${paths.agentsDir}/${agent.filename}`);
    } else {
      console.log(`  skipped ${paths.agentsDir}/${agent.filename} (already exists)`);
    }
  }

  // 生成 Pipeline 定义——根据项目类型动态编排 stage
  const pipelineFile = join(projectRoot, ".pipeline", "feature.ts");
  if (!existsSync(pipelineFile)) {
    writeFileSync(pipelineFile, generatePipelineDefinition(ctx));
    console.log(`  created .pipeline/feature.ts`);
  } else {
    console.log(`  skipped .pipeline/feature.ts (already exists)`);
  }

  // 追加全局配置（CLAUDE.md / AGENTS.md）
  const globalConfig = paths.globalConfig;
  if (adapter === "claude-code") {
    appendGlobalConfig(projectRoot, "CLAUDE.md", adapter, paths);
  } else if (adapter === "codex") {
    appendGlobalConfig(projectRoot, "AGENTS.md", adapter, paths);
  }

  // 输出摘要
  console.log(`\n╭─ 初始化完成 ──────────────────────────────────────╮`);
  console.log(`│  Adapter:    ${adapter}`);
  console.log(`│  项目类型:   ${ctx.projectType}`);
  console.log(`│  技术栈:     ${ctx.stack.join(", ") || "(未检测到)"}`);
  console.log(`│  Agent 数:   ${agents.length} (${agents.map((a) => a.name).join(", ")})`);
  console.log(`│  Pipeline:   .pipeline/feature.ts`);
  console.log(`╰──────────────────────────────────────────────────────╯`);
  console.log();
  console.log(`下一步：`);
  console.log(`  1. 检查 ${paths.agentsDir}/ 中的 Agent 定义，按需调整`);
  console.log(`  2. 编辑 .pipeline/feature.ts 调整流水线编排`);
  console.log(`  3. npx ai-pipeline generate --adapter ${adapter}`);
  console.log(`  4. npx ai-pipeline serve`);
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
