#!/usr/bin/env tsx
/**
 * AI Pipeline CLI — 跨 IDE 的 AI 编排 SDK 命令行工具
 *
 * 主命令：
 *   serve [--port]       启动 Pipeline Server + Dashboard
 *
 * 初始化和编排请通过 ai-pipeline Skill 驱动（参见 SKILL.md）。
 * 旧命令 init / generate / status 仍可用于向后兼容。
 */

export {};

const HELP = `
ai-pipeline — 跨 IDE 的 AI 编排 SDK

用法:
  ai-pipeline serve [--port <port>]              启动 Server + Dashboard

Skill 驱动（推荐）:
  初始化和编排请通过 ai-pipeline Skill 驱动，参见 SKILL.md。
  Skill 内部会调用 scripts/ 下的脚本完成扫描、生成等工作。

旧命令（向后兼容）:
  ai-pipeline init <cursor|claude-code|codex>   初始化项目
  ai-pipeline generate [file] [--adapter]        编译 pipeline 定义
  ai-pipeline status                             查看 pipeline 状态

选项:
  --help, -h     显示帮助
  --version, -v  显示版本号
`.trim();

const args = process.argv.slice(2);

if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
  console.log(HELP);
  process.exit(0);
}

if (args.includes("--version") || args.includes("-v")) {
  const pkg = await import("../package.json");
  console.log(pkg.version);
  process.exit(0);
}

const command = args[0];
const restArgs = args.slice(1);

switch (command) {
  case "serve": {
    const { runServe } = await import("./commands/serve.ts");
    await runServe(restArgs);
    break;
  }
  case "init": {
    console.warn("[提示] 推荐通过 ai-pipeline Skill 进行初始化。CLI init 仅做向后兼容。");
    const { runInit } = await import("./commands/init.ts");
    await runInit(restArgs);
    break;
  }
  case "generate": {
    console.warn("[提示] 推荐通过 ai-pipeline Skill 进行生成。CLI generate 仅做向后兼容。");
    const { runGenerate } = await import("./commands/generate.ts");
    await runGenerate(restArgs);
    break;
  }
  case "status": {
    const { runStatus } = await import("./commands/status.ts");
    await runStatus(restArgs);
    break;
  }
  default:
    console.error(`Unknown command: ${command}`);
    console.log(HELP);
    process.exit(1);
}
