/**
 * Orchestrator Skill 生成器
 *
 * 从 Manifest + Adapter 信息生成 IDE 专属的 Orchestrator SKILL.md。
 * 这让每条 pipeline 都有一份专属的编排说明书，AI 加载后即可按图索骥。
 */

import type { PipelineManifest, ManifestStageDef } from "../engine/types.ts";
import { getAdapterPaths, type AdapterName, type AdapterPaths } from "../adapters/paths.ts";

function generateStageInstruction(
  stage: ManifestStageDef,
  adapter: AdapterName,
  paths: AdapterPaths,
  pipelineId: string,
): string {
  if (stage.gate) {
    return generateGateInstruction(stage, pipelineId);
  }
  if (stage.skill) {
    return generateSkillInstruction(stage, pipelineId);
  }
  if (stage.parallel && stage.parallel.length > 0) {
    return generateParallelInstruction(stage, adapter, paths, pipelineId);
  }
  if (stage.agent) {
    return generateAgentInstruction(stage, adapter, paths, pipelineId);
  }
  return `执行阶段 "${stage.name}"。`;
}

function generateAgentInstruction(
  stage: ManifestStageDef,
  adapter: AdapterName,
  paths: AdapterPaths,
  pipelineId: string,
): string {
  const tool = paths.agentToolName;
  const defDir = paths.agentsDir;
  const ext = paths.agentFileExt;

  const lines = [
    `### ${stage.label ?? stage.name} — Agent Stage`,
    ``,
    `**委托给**: \`${stage.agent}\` (via ${tool})`,
    ``,
    `1. 上报阶段开始：`,
    "```bash",
    `curl -s -X POST http://127.0.0.1:19090/api/v1/pipeline/stage \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '{"pipeline":"${pipelineId}","stage":"${stage.name}","status":"active"}'`,
    "```",
    ``,
    `2. 使用 ${tool} 派遣 SubAgent：`,
  ];

  if (adapter === "cursor") {
    lines.push(
      "```",
      `Task tool:`,
      `  description: "[pipeline:${pipelineId}] ${stage.agent}: 执行 ${stage.name} 阶段任务"`,
      `  prompt: "操作前必须先读取 ${defDir}/${stage.agent}${ext} 并严格遵循其中的全部指令。\\n\\n## 任务\\n<详细任务描述>\\n\\n## 上下文\\n- Change: <change-name>\\n- 相关文件: <上一阶段产出>"`,
      "```",
    );
  } else if (adapter === "claude-code") {
    lines.push(
      "```",
      `Agent tool:`,
      `  agent_type: "${stage.agent}"`,
      `  prompt: "[pipeline:${pipelineId}] <详细任务描述>"`,
      "```",
      ``,
      `> Claude Code 会自动加载 \`${defDir}/${stage.agent}${ext}\` 中的 frontmatter 定义和指令。`,
    );
  } else {
    lines.push(
      "```",
      `请 spawn ${stage.agent} agent 执行以下任务：`,
      `"[pipeline:${pipelineId}] <详细任务描述>"`,
      "```",
      ``,
      `> Codex 会自动匹配 \`${defDir}/${stage.agent}${ext}\` 中的自定义 Agent 定义。`,
    );
  }

  lines.push(
    ``,
    `3. SubAgent 完成后上报阶段完成：`,
    "```bash",
    `curl -s -X POST http://127.0.0.1:19090/api/v1/pipeline/stage \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '{"pipeline":"${pipelineId}","stage":"${stage.name}","status":"completed"}'`,
    "```",
  );

  return lines.join("\n");
}

function generateSkillInstruction(
  stage: ManifestStageDef,
  pipelineId: string,
): string {
  return [
    `### ${stage.label ?? stage.name} — Skill Stage`,
    ``,
    `**由主 Agent 直接执行**: \`${stage.skill}\``,
    ``,
    `> Hook 无法感知 Skill 调用，状态必须手动上报。`,
    ``,
    `1. 上报阶段开始：`,
    "```bash",
    `curl -s -X POST http://127.0.0.1:19090/api/v1/pipeline/stage \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '{"pipeline":"${pipelineId}","stage":"${stage.name}","status":"active"}'`,
    "```",
    ``,
    `2. 加载并执行 \`${stage.skill}\` Skill 的工作流程`,
    ``,
    `3. 上报阶段完成：`,
    "```bash",
    `curl -s -X POST http://127.0.0.1:19090/api/v1/pipeline/stage \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '{"pipeline":"${pipelineId}","stage":"${stage.name}","status":"completed"}'`,
    "```",
  ].join("\n");
}

function generateGateInstruction(
  stage: ManifestStageDef,
  pipelineId: string,
): string {
  const desc = stage.gate_description ?? stage.label ?? stage.name;
  return [
    `### ${desc} — Gate Stage`,
    ``,
    `**暂停并等待用户确认。**`,
    ``,
    "```markdown",
    `## Gate: ${desc}`,
    ``,
    `<上一阶段的结论摘要>`,
    ``,
    `**选项：**`,
    `1. 通过 — 继续下一阶段`,
    `2. 需要修改 — 指定回退到哪个阶段`,
    `3. 终止流水线`,
    "```",
    ``,
    `用户确认"通过"后执行：`,
    "```bash",
    `curl -s -X POST http://127.0.0.1:19090/api/v1/pipeline/gate \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '{"pipeline":"${pipelineId}","gate":"${stage.name}","result":"passed"}'`,
    "```",
  ].join("\n");
}

function generateParallelInstruction(
  stage: ManifestStageDef,
  adapter: AdapterName,
  paths: AdapterPaths,
  pipelineId: string,
): string {
  const tool = paths.agentToolName;
  const defDir = paths.agentsDir;
  const ext = paths.agentFileExt;
  const agents = stage.parallel ?? [];

  const lines = [
    `### ${stage.label ?? stage.name} — Parallel Stage`,
    ``,
    `**并行执行 ${agents.length} 个 SubAgent** (via ${tool})`,
    ``,
    `1. 上报阶段开始：`,
    "```bash",
    `curl -s -X POST http://127.0.0.1:19090/api/v1/pipeline/stage \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '{"pipeline":"${pipelineId}","stage":"${stage.name}","status":"active"}'`,
    "```",
    ``,
    `2. 在**同一条消息**中发起多个 ${tool} 调用：`,
    ``,
  ];

  for (const agent of agents) {
    if (adapter === "cursor") {
      lines.push(
        `**${agent}**:`,
        "```",
        `Task tool:`,
        `  description: "[pipeline:${pipelineId}] ${agent}: 执行 ${stage.name}"`,
        `  prompt: "操作前必须先读取 ${defDir}/${agent}${ext} 并严格遵循其中的全部指令。\\n\\n## 任务\\n..."`,
        "```",
        ``,
      );
    } else if (adapter === "claude-code") {
      lines.push(
        `**${agent}**:`,
        "```",
        `Agent tool:`,
        `  agent_type: "${agent}"`,
        `  prompt: "[pipeline:${pipelineId}] ..."`,
        "```",
        ``,
      );
    } else {
      lines.push(`**${agent}**: spawn ${agent} agent "[pipeline:${pipelineId}] ..."`, ``);
    }
  }

  lines.push(
    `3. 等待**所有**并行 SubAgent 完成后再继续。如有失败，保留成功的结果，只重跑失败的。`,
    ``,
    `4. 上报阶段完成：`,
    "```bash",
    `curl -s -X POST http://127.0.0.1:19090/api/v1/pipeline/stage \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '{"pipeline":"${pipelineId}","stage":"${stage.name}","status":"completed"}'`,
    "```",
  );

  return lines.join("\n");
}

export function generateOrchestratorSkill(
  manifest: PipelineManifest,
  adapter: string,
): string {
  const adapterName = adapter as AdapterName;
  const paths = getAdapterPaths(adapterName);
  const pipelineId = `<pipeline-id>`;

  const flow = manifest.stages
    .map((s) => {
      if (s.gate) return `[${s.gate_description ?? s.label ?? s.name}]`;
      if (s.parallel && s.parallel.length > 0) return `${s.label ?? s.name}(${s.parallel.join(" ∥ ")})`;
      return s.label ?? s.name;
    })
    .join(" → ");

  const stageRows = manifest.stages
    .map((s) => {
      const type = s.gate ? "Gate" : s.skill ? `Skill: ${s.skill}` : s.parallel?.length ? `Parallel: ${s.parallel.join(", ")}` : `Agent: ${s.agent}`;
      return `| ${s.name} | ${s.label ?? s.name} | ${type} |`;
    })
    .join("\n");

  const stageInstructions = manifest.stages
    .map((s) => generateStageInstruction(s, adapterName, paths, pipelineId))
    .join("\n\n");

  return `---
name: orchestrator-${manifest.name}
description: "${manifest.name}" 流水线编排器。协调 ${manifest.stages.length} 个阶段完成完整开发周期。用户说"开始流水线""启动编排""全流程"时触发。必须作为 Skill 由主 Agent 加载（而非 SubAgent），以便通过 ${paths.agentToolName} 调度子 Agent。
---

# ${manifest.name} 流水线编排器

加载本 Skill 后，你（主 Agent）将扮演流水线编排器角色。
你的职责是按顺序调度专家 SubAgent 完成一个完整的功能开发周期。

## 核心原则

- **你不写代码、不做设计、不做测试** —— 你只编排和协调
- **每个阶段委托给对应的专家 SubAgent 或 Skill**
- **在 Gate 处暂停并汇报**，等用户确认后再继续
- **中文沟通**，技术术语保留英文
- **主动上报状态** —— 每个阶段开始/完成时调用 Pipeline Server API

## 前置条件

Pipeline Server 必须运行：
\`\`\`bash
npx ai-pipeline serve
# Dashboard: http://127.0.0.1:19090/
\`\`\`

## 流程总览

\`\`\`
${flow}
\`\`\`

| 阶段 | 标签 | 类型 |
|------|------|------|
${stageRows}

涉及的 Agent: ${manifest.agents.length > 0 ? manifest.agents.join(", ") : "(无)"}

## 启动流程

1. 查询已有流水线：\`curl -s http://127.0.0.1:19090/api/v1/pipelines\`
2. 如有未完成实例，进入恢复流程
3. 否则询问用户变更名称（kebab-case），创建实例：

\`\`\`bash
curl -s -X POST http://127.0.0.1:19090/api/v1/pipelines \\
  -H "Content-Type: application/json" \\
  -d '{"template": "${manifest.name}", "change_name": "<change-name>"}'
\`\`\`

响应中 \`id\` 字段即为 pipeline_id，后续所有操作使用此 ID。

## 逐阶段执行

${stageInstructions}

## 中断恢复

当用户说"继续"或再次触发编排器时：

1. \`curl -s http://127.0.0.1:19090/api/v1/pipelines\` 查询所有实例
2. 列出未完成的实例供用户选择（仅一个时自动恢复）
3. 调用 \`POST /api/v1/pipelines\`（幂等，返回 \`resumed: true\`）
4. 根据 stages 状态定位中断点
5. 告知用户恢复点，确认后继续

## 跳过与回退

用户可以在任何 Gate 处：
- **跳过**：说"跳过" — 标记当前阶段为 skipped
- **回退**：说"回到 implement" — 从指定阶段重新执行
- **终止**：说"停""暂停" — 保存状态并退出

## 完成总结

所有阶段完成后：

\`\`\`markdown
## 流水线完成

**Change**: <name>
**Duration**: <total>

| 阶段 | 耗时 | 状态 |
|------|------|------|
| ...  | Xs   | done |

### 产出物
- OpenSpec: openspec/changes/archive/<date>-<name>/
- 代码: <变更文件>
- 测试: <测试路径>
\`\`\`

## 约束

- 绝不自己写代码或做设计 —— 所有工作委托给专家 SubAgent
- Gate 处必须暂停 —— 不能自动跳过，必须等用户确认
- 传递完整上下文 —— 调度 SubAgent 时提供足够的 prompt 上下文
- 汇报进度 —— 每个阶段完成后简要汇报
- 始终在 SubAgent prompt 开头注入 Agent 定义文件的读取指令

## 参考文档（按需加载）

需要更详细的指导时，读取 ai-pipeline 包中的 references 目录：

| 文件 | 何时读取 |
|------|----------|
| \`references/server-api.md\` | 操作 Pipeline Server API 遇到问题时 |
| \`references/adapter-guide.md\` | 不确定 Agent 调度方式时 |
| \`references/testing/test-architecture.md\` | qa-test 阶段需要测试分层指导时 |
`;
}
