#!/usr/bin/env node

/**
 * CLI Wrapper — 通过 Node --import tsx 执行 TypeScript 入口
 * 用户只需 Node.js >= 18，无需全局安装 tsx 或 bun
 */

import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { fork } from "node:child_process";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const tsEntry = join(__dirname, "ai-pipeline.ts");

// 从 ai-pipeline 包自身的 node_modules 中解析 tsx/esm 的绝对路径
// 这样即使 cwd 是用户项目（没有安装 tsx），也能正确找到
const require = createRequire(import.meta.url);
const tsxEsmPath = require.resolve("tsx/esm");
const tsxEsmUrl = pathToFileURL(tsxEsmPath).href;

const child = fork(tsEntry, process.argv.slice(2), {
  execArgv: ["--import", tsxEsmUrl],
  stdio: "inherit",
  cwd: process.cwd(),
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
