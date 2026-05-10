/**
 * 示例：OpenSpec 驱动的变更流水线
 *
 * 以 OpenSpec 工作流为核心，展示"提案驱动开发"的完整闭环：
 *   提案 → 评审 → 人工确认 → 实现 → 代码审查 → 测试 → 归档
 *
 * 适用于需要先达成方案共识、再动手编码的团队协作场景。
 * 这也是 ai-pipeline 最典型的使用方式。
 */

import { pipeline, stage, gate, parallel } from "../src/sdk/index.ts";

export default pipeline("openspec-driven", async (ctx) => {
  // ── 阶段 1：探索与理解需求 ──
  // explorer 分析代码库，输出影响范围、技术约束、建议方案
  const exploration = stage("explore", {
    agent: "explorer",
    task: "分析需求的技术可行性和影响范围",
  });

  // ── 阶段 2：创建 OpenSpec 提案 ──
  // openspec-propose Skill 基于 explorer 的结论，在 openspec/changes/ 下创建：
  //   proposal.md  —— 问题背景和解决方案
  //   tasks.md     —— 实现任务清单（可按前后端分组）
  //   design.md    —— 技术设计（可选）
  //   specs/       —— 规格变更增量
  stage("propose", {
    skill: "openspec-propose",
    input: { exploration: exploration.output },
  });

  // ── 阶段 3：方案评审 ──
  // reviewer 审查 proposal.md 和 design.md，给出评审意见
  stage("review", {
    agent: "reviewer",
    task: "审查 OpenSpec 提案的合理性和完整性",
  });

  // ── Gate 1：人工确认方案设计 ──
  // 团队确认提案可行后再进入编码阶段，避免无效劳动
  const designDecision = gate("确认方案设计");
  if (designDecision === "reject") {
    // 方案被打回，回到提案阶段修改
    stage("revise-proposal", {
      skill: "openspec-propose",
      task: "根据评审意见修改提案",
    });
    gate("确认修改后的方案");
  }

  // ── 阶段 4：按 tasks.md 实现 ──
  // 从 OpenSpec tasks.md 中读取任务清单，交给对应的 Agent 执行
  stage("implement", {
    agent: "implementer",
    task: "按照 openspec/changes/ 下的 tasks.md 逐项完成实现",
  });

  // ── 阶段 5：代码审查 ──
  stage("code-review", {
    agent: "code-reviewer",
    task: "审查实现是否符合 proposal.md 和 design.md 中的设计",
  });

  // ── Gate 2：人工确认代码质量 ──
  gate("确认代码质量");

  // ── 阶段 6：测试 ──
  stage("test", {
    agent: "qa-tester",
    task: "基于 tasks.md 和 specs/ 编写并运行测试",
  });

  // ── 阶段 7：归档 ──
  // openspec-archive Skill 将已完成的变更归档：
  //   移动到 openspec/changes/archive/<date>-<name>/
  //   合并 spec delta 到主规格文件
  stage("archive", {
    skill: "openspec-archive",
  });
});
