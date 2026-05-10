#!/usr/bin/env tsx
/**
 * AI Pipeline CLI — 跨 IDE 的 AI 编排 SDK 命令行工具
 *
 * 子命令：
 *   init <adapter>       初始化项目（生成 hooks.json、模板等）
 *   generate [file]      编译 pipeline 定义 → manifest + orchestrator skill
 *   serve [--port]       启动 Pipeline Server + Dashboard
 *   status               查看当前 pipeline 实例状态
 */

import { parseArgs } from "node:util";
import { resolve } from "node:path";

const HELP = `
ai-pipeline — 跨 IDE 的 AI 编排 SDK

用法:
  ai-pipeline init <cursor|claude-code|codex>   初始化项目
  ai-pipeline generate [file] [--adapter]        编译 pipeline 定义
  ai-pipeline serve [--port <port>]              启动 Server + Dashboard
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
  case "init": {
    const { runInit } = await import("./commands/init.ts");
    await runInit(restArgs);
    break;
  }
  case "generate": {
    const { runGenerate } = await import("./commands/generate.ts");
    await runGenerate(restArgs);
    break;
  }
  case "serve": {
    const { runServe } = await import("./commands/serve.ts");
    await runServe(restArgs);
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
