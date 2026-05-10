#!/usr/bin/env node

/**
 * CLI Wrapper — 通过 Node --import tsx 执行 TypeScript 入口
 * 用户只需 Node.js >= 18，无需全局安装 tsx 或 bun
 */

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { fork } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const tsEntry = join(__dirname, "ai-pipeline.ts");

const child = fork(tsEntry, process.argv.slice(2), {
  execArgv: ["--import", "tsx/esm"],
  stdio: "inherit",
  cwd: process.cwd(),
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
