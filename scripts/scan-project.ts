#!/usr/bin/env tsx
/**
 * 项目上下文扫描脚本
 *
 * 扫描目标项目的技术栈、目录结构、OpenSpec 规范等信息，
 * 输出 JSON 格式的 ProjectContext 供后续脚本消费。
 *
 * 用法：
 *   tsx scripts/scan-project.ts [projectRoot]
 *
 * 参数：
 *   projectRoot  目标项目根目录，默认为 cwd
 *
 * 输出：
 *   stdout → JSON 格式的 ProjectContext
 *   stderr → 人类可读的摘要
 */

import { resolve } from "node:path";
import { scanProject, formatContextSummary } from "../src/scanner/project-scanner.ts";

const projectRoot = resolve(process.argv[2] ?? process.cwd());

const ctx = scanProject(projectRoot);

// 人类可读摘要输出到 stderr（不干扰 JSON 管道）
console.error(formatContextSummary(ctx));

// 机器可读 JSON 输出到 stdout
console.log(JSON.stringify(ctx, null, 2));
