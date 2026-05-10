/**
 * 项目上下文扫描器
 *
 * 自动检测项目的技术栈、目录结构、OpenSpec 规范等信息，
 * 为 AI 生成高质量 Agent 定义提供上下文。
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";

export interface ProjectContext {
  /** 项目名称 */
  name: string;
  /** 检测到的技术栈 */
  stack: string[];
  /** 项目类型标签 */
  projectType: "go-backend" | "node-fullstack" | "go-react-fullstack" | "python-backend" | "unknown";
  /** 顶层目录结构 */
  structure: string[];
  /** OpenSpec 规范列表 */
  openspecSpecs: string[];
  /** OpenSpec config.yaml 中的 context */
  openspecContext: string;
  /** 已有的 AGENTS.md / CLAUDE.md 内容（前 50 行） */
  existingGlobalConfig: string;
  /** 检测到的构建工具 */
  buildTools: string[];
  /** Go module 路径 */
  goModule?: string;
  /** 前端框架 */
  frontendFramework?: string;
  /** 检测到的测试框架 */
  testFrameworks: string[];
}

export function scanProject(projectRoot: string): ProjectContext {
  const ctx: ProjectContext = {
    name: basename(projectRoot),
    stack: [],
    projectType: "unknown",
    structure: [],
    openspecSpecs: [],
    openspecContext: "",
    existingGlobalConfig: "",
    buildTools: [],
    testFrameworks: [],
  };

  // 扫描顶层目录结构
  try {
    ctx.structure = readdirSync(projectRoot)
      .filter((f) => !f.startsWith(".") && !f.startsWith("node_modules"))
      .filter((f) => {
        try { return statSync(join(projectRoot, f)).isDirectory(); } catch { return false; }
      })
      .slice(0, 20);
  } catch { /* ignore */ }

  // 检测 Go
  if (existsSync(join(projectRoot, "backend", "go.mod")) || existsSync(join(projectRoot, "go.mod"))) {
    ctx.stack.push("Go");
    const goModPath = existsSync(join(projectRoot, "backend", "go.mod"))
      ? join(projectRoot, "backend", "go.mod")
      : join(projectRoot, "go.mod");
    try {
      const goMod = readFileSync(goModPath, "utf-8");
      const match = goMod.match(/^module\s+(.+)$/m);
      if (match) ctx.goModule = match[1].trim();
    } catch { /* ignore */ }

    // 检测 Go 框架
    try {
      const goMod = readFileSync(goModPath, "utf-8");
      if (goMod.includes("github.com/gin-gonic/gin")) ctx.stack.push("Gin");
      if (goMod.includes("github.com/spf13/cobra")) ctx.stack.push("Cobra");
      if (goMod.includes("github.com/spf13/viper")) ctx.stack.push("Viper");
      if (goMod.includes("gorm.io/gorm")) ctx.stack.push("GORM");
      if (goMod.includes("go.uber.org/wire")) ctx.stack.push("Wire");
    } catch { /* ignore */ }
  }

  // 检测 Node/Frontend
  const frontendPkg = existsSync(join(projectRoot, "frontend", "package.json"))
    ? join(projectRoot, "frontend", "package.json")
    : existsSync(join(projectRoot, "package.json"))
      ? join(projectRoot, "package.json")
      : null;

  if (frontendPkg) {
    try {
      const pkg = JSON.parse(readFileSync(frontendPkg, "utf-8"));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (allDeps["react"]) { ctx.stack.push("React"); ctx.frontendFramework = "React"; }
      if (allDeps["vue"]) { ctx.stack.push("Vue"); ctx.frontendFramework = "Vue"; }
      if (allDeps["typescript"]) ctx.stack.push("TypeScript");
      if (allDeps["tailwindcss"]) ctx.stack.push("Tailwind CSS");
      if (allDeps["vite"]) ctx.buildTools.push("Vite");
      if (allDeps["next"]) { ctx.stack.push("Next.js"); ctx.frontendFramework = "Next.js"; }

      // 测试框架
      if (allDeps["jest"]) ctx.testFrameworks.push("Jest");
      if (allDeps["vitest"]) ctx.testFrameworks.push("Vitest");
      if (allDeps["playwright"]) ctx.testFrameworks.push("Playwright");
    } catch { /* ignore */ }
  }

  // 检测 Python
  if (existsSync(join(projectRoot, "requirements.txt")) || existsSync(join(projectRoot, "pyproject.toml"))) {
    ctx.stack.push("Python");
  }

  // 检测构建工具
  if (existsSync(join(projectRoot, "backend", "Makefile")) || existsSync(join(projectRoot, "Makefile"))) {
    ctx.buildTools.push("Make");
  }
  if (existsSync(join(projectRoot, "docker-compose.yml")) || existsSync(join(projectRoot, "docker-compose.yaml"))) {
    ctx.buildTools.push("Docker Compose");
  }

  // 推断项目类型
  const hasGo = ctx.stack.includes("Go");
  const hasFrontend = ctx.frontendFramework !== undefined;
  if (hasGo && hasFrontend) ctx.projectType = "go-react-fullstack";
  else if (hasGo) ctx.projectType = "go-backend";
  else if (hasFrontend) ctx.projectType = "node-fullstack";
  else if (ctx.stack.includes("Python")) ctx.projectType = "python-backend";

  // 扫描 OpenSpec 规范
  const specsDir = join(projectRoot, "openspec", "specs");
  if (existsSync(specsDir)) {
    try {
      ctx.openspecSpecs = readdirSync(specsDir)
        .filter((d) => {
          try { return statSync(join(specsDir, d)).isDirectory(); } catch { return false; }
        });
    } catch { /* ignore */ }
  }

  // 读取 OpenSpec config context
  const openspecConfig = join(projectRoot, "openspec", "config.yaml");
  if (existsSync(openspecConfig)) {
    try {
      const content = readFileSync(openspecConfig, "utf-8");
      const contextMatch = content.match(/context:\s*\|?\n([\s\S]*?)(?:\n\w|\n$|$)/);
      if (contextMatch) ctx.openspecContext = contextMatch[1].trim();
    } catch { /* ignore */ }
  }

  // 读取已有的全局配置
  for (const gf of ["AGENTS.md", "CLAUDE.md", ".cursor/rules/root.md"]) {
    const gfPath = join(projectRoot, gf);
    if (existsSync(gfPath)) {
      try {
        const lines = readFileSync(gfPath, "utf-8").split("\n").slice(0, 50);
        ctx.existingGlobalConfig = `[${gf}]\n${lines.join("\n")}`;
        break;
      } catch { /* ignore */ }
    }
  }

  // Go 测试
  if (hasGo) {
    ctx.testFrameworks.push("go test");
    const goModPath = existsSync(join(projectRoot, "backend", "go.mod"))
      ? join(projectRoot, "backend", "go.mod") : join(projectRoot, "go.mod");
    try {
      const goMod = readFileSync(goModPath, "utf-8");
      if (goMod.includes("github.com/stretchr/testify")) ctx.testFrameworks.push("testify");
    } catch { /* ignore */ }
  }

  return ctx;
}

/**
 * 格式化项目上下文为人类可读的摘要
 */
export function formatContextSummary(ctx: ProjectContext): string {
  const lines: string[] = [];
  lines.push(`项目: ${ctx.name}`);
  lines.push(`类型: ${ctx.projectType}`);
  lines.push(`技术栈: ${ctx.stack.join(", ") || "(未检测到)"}`);
  if (ctx.goModule) lines.push(`Go Module: ${ctx.goModule}`);
  if (ctx.frontendFramework) lines.push(`前端框架: ${ctx.frontendFramework}`);
  lines.push(`构建工具: ${ctx.buildTools.join(", ") || "(无)"}`);
  lines.push(`测试框架: ${ctx.testFrameworks.join(", ") || "(无)"}`);
  lines.push(`目录结构: ${ctx.structure.join(", ")}`);
  if (ctx.openspecSpecs.length > 0) {
    lines.push(`OpenSpec 规范: ${ctx.openspecSpecs.join(", ")}`);
  }
  return lines.join("\n");
}
