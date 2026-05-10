/**
 * Agent Prompt 生成器
 *
 * 根据项目上下文和 adapter 类型，生成让 AI 创建高质量 Agent 定义的 prompt。
 * 这些 prompt 不是直接产出文件，而是作为指令让 AI（用户的 IDE Agent）去执行。
 */

import type { ProjectContext } from "../scanner/project-scanner.ts";
import type { AdapterName } from "../adapters/paths.ts";

interface AgentRole {
  name: string;
  title: string;
  responsibility: string;
  tools: string[];
  constraints: string[];
  contextHints: string[];
}

/**
 * 根据项目类型推荐 Agent 角色
 */
function getRecommendedRoles(ctx: ProjectContext): AgentRole[] {
  const roles: AgentRole[] = [];

  // 通用角色：探索者
  roles.push({
    name: "explorer",
    title: "项目探索与需求分析专家",
    responsibility: "分析代码库结构、理解现有架构、梳理需求影响范围",
    tools: ["Read", "Grep", "Glob", "SemanticSearch"],
    constraints: [
      "只读操作，不修改任何文件",
      "输出结构化的分析报告",
      "必须标注影响范围和风险点",
    ],
    contextHints: buildExplorerHints(ctx),
  });

  // 根据项目类型定制
  if (ctx.projectType === "go-react-fullstack" || ctx.projectType === "go-backend") {
    roles.push({
      name: "go-implementer",
      title: "Go 后端实现专家",
      responsibility: "编写 Go 后端代码，遵循 DDD 分层架构",
      tools: ["Read", "Write", "StrReplace", "Shell"],
      constraints: [
        "严格遵循 DDD 分层：domain → application → interfaces → infrastructure",
        "Domain 层不得依赖 infrastructure 或 interfaces",
        ctx.openspecSpecs.includes("backend-go-style")
          ? "遵循 openspec/specs/backend-go-style/spec.md 中的编码规范"
          : "遵循 Go 官方编码规范",
        "每个变更必须包含对应的单元测试",
        ctx.buildTools.includes("Make") ? "提交前确保 `make check` 通过" : "提交前确保 `go vet ./...` 通过",
      ],
      contextHints: buildGoHints(ctx),
    });
  }

  if (ctx.projectType === "go-react-fullstack" || ctx.projectType === "node-fullstack") {
    roles.push({
      name: "frontend-implementer",
      title: `${ctx.frontendFramework || "前端"} 实现专家`,
      responsibility: `编写 ${ctx.frontendFramework || "前端"} 代码，实现 UI 组件和页面逻辑`,
      tools: ["Read", "Write", "StrReplace", "Shell"],
      constraints: [
        "API 调用必须通过 services 层，不得在组件中直接 fetch",
        ctx.openspecSpecs.includes("frontend-typescript-style")
          ? "遵循 openspec/specs/frontend-typescript-style/spec.md 中的编码规范"
          : `遵循 ${ctx.frontendFramework || "前端"} 社区最佳实践`,
        "提交前确保 `npm run lint` 通过",
        "组件必须有 TypeScript 类型定义",
      ],
      contextHints: buildFrontendHints(ctx),
    });
  }

  // 代码审查角色
  roles.push({
    name: "reviewer",
    title: "代码审查专家",
    responsibility: "审查代码变更的质量、安全性、架构一致性",
    tools: ["Read", "Grep", "Glob", "Shell"],
    constraints: [
      "只读操作，通过评论报告问题",
      "必须检查：类型安全、错误处理、测试覆盖、架构合规",
      "给出具体的改进建议而非模糊评论",
      ...ctx.openspecSpecs.map((s) => `检查是否符合 openspec/specs/${s}/spec.md`),
    ],
    contextHints: buildReviewerHints(ctx),
  });

  return roles;
}

function buildExplorerHints(ctx: ProjectContext): string[] {
  const hints: string[] = [];
  hints.push(`项目目录结构: ${ctx.structure.join(", ")}`);
  if (ctx.goModule) hints.push(`Go 模块路径: ${ctx.goModule}`);
  if (ctx.openspecSpecs.length > 0) {
    hints.push(`需要了解的 OpenSpec 规范: ${ctx.openspecSpecs.join(", ")}`);
  }
  return hints;
}

function buildGoHints(ctx: ProjectContext): string[] {
  const hints: string[] = [];
  if (ctx.goModule) hints.push(`Go module: ${ctx.goModule}`);
  hints.push(`Go 相关技术栈: ${ctx.stack.filter((s) => ["Go", "Gin", "Cobra", "Viper", "GORM", "Wire"].includes(s)).join(", ")}`);
  if (ctx.structure.includes("backend")) {
    hints.push("后端代码在 backend/ 目录");
    hints.push("DDD 结构: backend/internal/{domain,application,interfaces,infrastructure}/");
  }
  return hints;
}

function buildFrontendHints(ctx: ProjectContext): string[] {
  const hints: string[] = [];
  hints.push(`前端框架: ${ctx.frontendFramework || "未知"}`);
  if (ctx.structure.includes("frontend")) hints.push("前端代码在 frontend/ 目录");
  const feStack = ctx.stack.filter((s) => ["React", "Vue", "TypeScript", "Tailwind CSS", "Next.js"].includes(s));
  if (feStack.length > 0) hints.push(`前端技术栈: ${feStack.join(", ")}`);
  return hints;
}

function buildReviewerHints(ctx: ProjectContext): string[] {
  const hints: string[] = [];
  if (ctx.testFrameworks.length > 0) hints.push(`测试框架: ${ctx.testFrameworks.join(", ")}`);
  if (ctx.openspecSpecs.length > 0) hints.push(`审查依据: ${ctx.openspecSpecs.map((s) => `openspec/specs/${s}/spec.md`).join(", ")}`);
  return hints;
}

/**
 * 生成 Cursor Agent .md 内容
 */
function renderCursorAgent(role: AgentRole): string {
  return [
    `# ${role.title}`,
    ``,
    `你是 **${role.title}**。`,
    ``,
    `## 职责`,
    ``,
    role.responsibility,
    ``,
    `## 可用工具`,
    ``,
    role.tools.map((t) => `- ${t}`).join("\n"),
    ``,
    `## 项目上下文`,
    ``,
    role.contextHints.map((h) => `- ${h}`).join("\n"),
    ``,
    `## 约束`,
    ``,
    role.constraints.map((c) => `- ${c}`).join("\n"),
    ``,
  ].join("\n");
}

/**
 * 生成 Claude Code Agent .md 内容（带 YAML frontmatter）
 */
function renderClaudeCodeAgent(role: AgentRole): string {
  const toolMap: Record<string, string> = {
    Read: "Read", Write: "Write", StrReplace: "Edit",
    Shell: "Bash", Grep: "Grep", Glob: "Glob", SemanticSearch: "Grep",
  };
  const claudeTools = [...new Set(role.tools.map((t) => toolMap[t] || t))];

  return [
    `---`,
    `name: ${role.name}`,
    `description: "${role.title}"`,
    `tools:`,
    ...claudeTools.map((t) => `  - ${t}`),
    `model: sonnet`,
    `---`,
    ``,
    `# ${role.title}`,
    ``,
    `你是 **${role.title}**。`,
    ``,
    `## 职责`,
    ``,
    role.responsibility,
    ``,
    `## 项目上下文`,
    ``,
    role.contextHints.map((h) => `- ${h}`).join("\n"),
    ``,
    `## 约束`,
    ``,
    role.constraints.map((c) => `- ${c}`).join("\n"),
    ``,
  ].join("\n");
}

/**
 * 生成 Codex Agent .toml 内容
 */
function renderCodexAgent(role: AgentRole): string {
  const instructions = [
    `你是 ${role.title}。`,
    ``,
    `## 职责`,
    ``,
    role.responsibility,
    ``,
    `## 项目上下文`,
    ``,
    ...role.contextHints.map((h) => `- ${h}`),
    ``,
    `## 约束`,
    ``,
    ...role.constraints.map((c) => `- ${c}`),
  ].join("\n");

  return [
    `name = "${role.name}"`,
    `description = "${role.title}"`,
    `model = "o3"`,
    `sandbox_mode = "${role.tools.includes("Write") ? "workspace-write" : "workspace-read"}"`,
    `developer_instructions = """`,
    instructions,
    `"""`,
    ``,
  ].join("\n");
}

export interface GeneratedAgent {
  name: string;
  filename: string;
  content: string;
}

/**
 * 根据项目上下文自动生成全部 Agent 定义
 */
export function generateAgents(ctx: ProjectContext, adapter: AdapterName): GeneratedAgent[] {
  const roles = getRecommendedRoles(ctx);

  const renderFn = adapter === "cursor" ? renderCursorAgent
    : adapter === "claude-code" ? renderClaudeCodeAgent
    : renderCodexAgent;

  const ext = adapter === "codex" ? ".toml" : ".md";

  return roles.map((role) => ({
    name: role.name,
    filename: `${role.name}${ext}`,
    content: renderFn(role),
  }));
}

/**
 * 根据项目上下文生成 pipeline 定义
 */
export function generatePipelineDefinition(ctx: ProjectContext): string {
  const hasBackend = ctx.projectType === "go-backend" || ctx.projectType === "go-react-fullstack";
  const hasFrontend = ctx.projectType === "node-fullstack" || ctx.projectType === "go-react-fullstack";

  const stages: string[] = [];
  stages.push(`  await stage("explore", { agent: "explorer" });`);
  stages.push(`  await stage("propose", { skill: "openspec-propose" });`);
  stages.push(`  await gate("确认方案设计");`);

  if (hasBackend && hasFrontend) {
    stages.push(``);
    stages.push(`  await parallel("implement", [`);
    stages.push(`    { agent: "go-implementer" },`);
    stages.push(`    { agent: "frontend-implementer" },`);
    stages.push(`  ]);`);
  } else if (hasBackend) {
    stages.push(``);
    stages.push(`  await stage("implement", { agent: "go-implementer" });`);
  } else if (hasFrontend) {
    stages.push(``);
    stages.push(`  await stage("implement", { agent: "frontend-implementer" });`);
  } else {
    stages.push(``);
    stages.push(`  await stage("implement", { agent: "implementer" });`);
  }

  stages.push(`  await stage("review", { agent: "reviewer" });`);
  stages.push(`  await gate("确认代码质量");`);
  stages.push(`  await stage("archive", { skill: "openspec-archive" });`);

  const pipelineName = ctx.name.replace(/[^a-zA-Z0-9_-]/g, "-");

  return [
    `import { pipeline, stage, gate, parallel } from "@toheart/ai-pipeline";`,
    ``,
    `export default pipeline("${pipelineName}", async (ctx) => {`,
    ...stages,
    `});`,
    ``,
  ].join("\n");
}
