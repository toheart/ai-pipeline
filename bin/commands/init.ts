/**
 * ai-pipeline init <adapter> — 初始化项目
 *
 * 根据目标 IDE 部署 hooks、模板、Agent 骨架等到用户项目中。
 * 输出目录根据 adapter 动态分叉。
 */

import { existsSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getAdapterPaths, isValidAdapter, VALID_ADAPTERS, type AdapterName } from "../../src/adapters/paths.ts";

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
 * 生成 Cursor Agent 骨架（纯 .md）
 */
function generateCursorAgentSkeleton(name: string): string {
  return [
    `# ${name}`,
    ``,
    `你是 ${name} 专家 SubAgent。`,
    ``,
    `## 职责`,
    ``,
    `<!-- 描述此 Agent 的具体职责 -->`,
    ``,
    `## 规范`,
    ``,
    `<!-- 此 Agent 遵循的编码/工作规范 -->`,
    ``,
    `## 约束`,
    ``,
    `- 不做超出职责范围的工作`,
    `- 遇到不确定的问题时暂停并汇报`,
    ``,
  ].join("\n");
}

/**
 * 生成 Claude Code Agent 骨架（.md + YAML frontmatter）
 */
function generateClaudeCodeAgentSkeleton(name: string): string {
  return [
    `---`,
    `name: ${name}`,
    `description: "${name} 专家子代理"`,
    `tools:`,
    `  - Read`,
    `  - Write`,
    `  - Edit`,
    `  - Bash`,
    `  - Glob`,
    `  - Grep`,
    `model: sonnet`,
    `---`,
    ``,
    `# ${name}`,
    ``,
    `你是 ${name} 专家子代理。`,
    ``,
    `## 职责`,
    ``,
    `<!-- 描述此 Agent 的具体职责 -->`,
    ``,
    `## 规范`,
    ``,
    `<!-- 此 Agent 遵循的编码/工作规范 -->`,
    ``,
    `## 约束`,
    ``,
    `- 不做超出职责范围的工作`,
    `- 遇到不确定的问题时暂停并汇报`,
    ``,
  ].join("\n");
}

/**
 * 生成 Codex Agent 骨架（.toml）
 */
function generateCodexAgentSkeleton(name: string): string {
  return [
    `name = "${name}"`,
    `description = "${name} 专家 Agent"`,
    `model = "gpt-5.3-codex"`,
    `sandbox_mode = "workspace-write"`,
    `developer_instructions = """`,
    `你是 ${name} 专家 Agent。`,
    ``,
    `## 职责`,
    ``,
    `# 描述此 Agent 的具体职责`,
    ``,
    `## 规范`,
    ``,
    `# 此 Agent 遵循的编码/工作规范`,
    ``,
    `## 约束`,
    ``,
    `- 不做超出职责范围的工作`,
    `- 遇到不确定的问题时暂停并汇报`,
    `"""`,
    ``,
  ].join("\n");
}

function generateAgentSkeleton(adapter: AdapterName, name: string): string {
  switch (adapter) {
    case "cursor":
      return generateCursorAgentSkeleton(name);
    case "claude-code":
      return generateClaudeCodeAgentSkeleton(name);
    case "codex":
      return generateCodexAgentSkeleton(name);
  }
}

/**
 * 生成 CLAUDE.md pipeline 编排章节
 */
function generateClaudeMdSection(): string {
  return [
    ``,
    `## AI Pipeline 编排`,
    ``,
    `本项目使用 [ai-pipeline](https://github.com/toheart/ai-pipeline) 进行 AI 开发流水线编排。`,
    ``,
    `- 流水线定义：\`.pipeline/*.ts\``,
    `- Agent 定义：\`.claude/agents/*.md\``,
    `- 编排器 Skill：\`.claude/skills/orchestrator-*/SKILL.md\``,
    `- Dashboard：\`http://127.0.0.1:19090/\``,
    ``,
    `### 常用命令`,
    ``,
    `\`\`\`bash`,
    `npx ai-pipeline generate --adapter claude-code   # 编译流水线`,
    `npx ai-pipeline serve                            # 启动看板`,
    `\`\`\``,
    ``,
  ].join("\n");
}

/**
 * 生成 AGENTS.md pipeline 编排章节
 */
function generateAgentsMdSection(): string {
  return [
    ``,
    `## AI Pipeline 编排`,
    ``,
    `本项目使用 [ai-pipeline](https://github.com/toheart/ai-pipeline) 进行 AI 开发流水线编排。`,
    ``,
    `- 流水线定义：\`.pipeline/*.ts\``,
    `- Agent 定义：\`.codex/agents/*.toml\``,
    `- 编排器 Skill：\`.codex/skills/orchestrator-*/SKILL.md\``,
    `- Dashboard：\`http://127.0.0.1:19090/\``,
    ``,
    `### 常用命令`,
    ``,
    `\`\`\`bash`,
    `npx ai-pipeline generate --adapter codex   # 编译流水线`,
    `npx ai-pipeline serve                      # 启动看板`,
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

  console.log(`╭─ AI Pipeline · ${adapter} adapter ──────────────────╮`);
  console.log(`│  Package:  ${pkgRoot}`);
  console.log(`│  Project:  ${projectRoot}`);
  console.log(`│  Output:   ${paths.configRoot}/`);
  console.log(`╰──────────────────────────────────────────────────────╯`);

  const adapterDir = join(pkgRoot, "src", "adapters", adapter);
  if (!existsSync(adapterDir)) {
    console.error(`Adapter not found: ${adapterDir}`);
    process.exit(1);
  }

  // 创建目录——使用 AdapterPaths 动态分叉
  const dirs = [
    ".pipeline",
    paths.agentsDir,
    paths.manifestsDir,
    paths.skillsDir,
    paths.hooksDir,
    paths.stateDir,
    paths.pipelinesDir,
    "templates",
  ];

  for (const d of dirs) {
    ensureDir(projectRoot, d);
  }

  // 部署 hooks.json
  const hooksTpl = join(adapterDir, "hooks.json.tpl");
  if (existsSync(hooksTpl)) {
    let content = readFileSync(hooksTpl, "utf-8");
    content = content.replace(/\$\{PROJECT_ROOT\}/g, projectRoot);

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

  // 部署示例模板
  const templatesDir = join(pkgRoot, "templates");
  if (existsSync(templatesDir)) {
    for (const f of readdirSync(templatesDir).filter((f) => f.endsWith(".yaml"))) {
      const target = join(projectRoot, "templates", f);
      if (!existsSync(target)) {
        copyFileSync(join(templatesDir, f), target);
        console.log(`  deployed templates/${f}`);
      }
    }
  }

  // 确保 .pipeline/ 目录被 Node 识别为 ESM 模块
  const pipelinePkg = join(projectRoot, ".pipeline", "package.json");
  if (!existsSync(pipelinePkg)) {
    writeFileSync(pipelinePkg, JSON.stringify({ type: "module" }, null, 2) + "\n");
    console.log("  created .pipeline/package.json (ESM marker)");
  }

  // 创建示例 pipeline 定义
  const examplePipeline = join(projectRoot, ".pipeline", "feature.ts");
  if (!existsSync(examplePipeline)) {
    writeFileSync(
      examplePipeline,
      [
        `import { pipeline, stage, gate, parallel } from "ai-pipeline";`,
        ``,
        `export default pipeline("feature", async (ctx) => {`,
        `  await stage("explore", { agent: "explorer" });`,
        `  await stage("propose", { skill: "openspec-propose" });`,
        `  await gate("确认方案设计");`,
        ``,
        `  await stage("implement", { agent: "implementer" });`,
        `  await gate("确认代码质量");`,
        `  await stage("archive", { skill: "openspec-archive" });`,
        `});`,
        ``,
      ].join("\n"),
    );
    console.log(`  created .pipeline/feature.ts (example)`);
  }

  // 生成示例 Agent 骨架
  const exampleAgents = ["explorer", "implementer"];
  for (const name of exampleAgents) {
    const agentFile = join(projectRoot, paths.agentsDir, `${name}${paths.agentFileExt}`);
    if (!existsSync(agentFile)) {
      writeFileSync(agentFile, generateAgentSkeleton(adapter, name));
      console.log(`  created ${paths.agentsDir}/${name}${paths.agentFileExt} (skeleton)`);
    }
  }

  // Claude Code：追加 CLAUDE.md 编排章节
  if (adapter === "claude-code") {
    const claudeMd = join(projectRoot, "CLAUDE.md");
    if (existsSync(claudeMd)) {
      const content = readFileSync(claudeMd, "utf-8");
      if (!content.includes("AI Pipeline 编排")) {
        writeFileSync(claudeMd, content + generateClaudeMdSection());
        console.log(`  updated CLAUDE.md (appended pipeline section)`);
      }
    } else {
      writeFileSync(claudeMd, `# Project Guide\n${generateClaudeMdSection()}`);
      console.log(`  created CLAUDE.md`);
    }
  }

  // Codex：追加 AGENTS.md 编排章节
  if (adapter === "codex") {
    const agentsMd = join(projectRoot, "AGENTS.md");
    if (existsSync(agentsMd)) {
      const content = readFileSync(agentsMd, "utf-8");
      if (!content.includes("AI Pipeline 编排")) {
        writeFileSync(agentsMd, content + generateAgentsMdSection());
        console.log(`  updated AGENTS.md (appended pipeline section)`);
      }
    } else {
      writeFileSync(agentsMd, `# Project Guide\n${generateAgentsMdSection()}`);
      console.log(`  created AGENTS.md`);
    }
  }

  console.log();
  console.log(`Done! Next steps:`);
  console.log(`  1. Edit .pipeline/feature.ts to define your pipeline`);
  console.log(`  2. npx ai-pipeline generate --adapter ${adapter}`);
  console.log(`  3. npx ai-pipeline serve`);
}
