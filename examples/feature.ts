/**
 * 示例：Feature 开发流水线
 *
 * 展示 SDK 的核心能力：条件分支、并行、循环重试、错误处理
 */

import { pipeline, stage, gate, parallel } from "../src/sdk/index.ts";

export default pipeline("feature", async (ctx) => {
  const exploration = stage("explore", { agent: "explorer" });

  if (exploration.output.scope === "config-only") {
    stage("review", { agent: "reviewer" });
    gate("确认配置变更");
    stage("archive", { skill: "openspec-archive" });
    return;
  }

  stage("propose", { skill: "openspec-propose" });
  gate("确认方案设计");

  parallel(
    stage("backend", { agent: "backend-implementer", scope: "backend/" }),
    stage("frontend", { agent: "frontend-implementer", scope: "frontend/" }),
  );

  let reviewPassed = false;
  let attempts = 0;
  while (!reviewPassed && attempts < 3) {
    const [beReview, feReview] = parallel(
      stage("be-review", { agent: "backend-reviewer" }),
      stage("fe-review", { agent: "frontend-reviewer" }),
    );

    const decision = gate("确认代码质量");
    if (decision === "approve") {
      reviewPassed = true;
    } else {
      if (beReview.output.issues) {
        stage("be-fix", { agent: "backend-implementer", input: { issues: beReview.output.issues } });
      }
      if (feReview.output.issues) {
        stage("fe-fix", { agent: "frontend-implementer", input: { issues: feReview.output.issues } });
      }
      attempts++;
    }
  }

  try {
    stage("qa-test", { agent: "qa-tester" });
  } catch {
    stage("qa-fix", { agent: "backend-implementer", task: "修复 QA 发现的问题" });
    stage("qa-retest", { agent: "qa-tester" });
  }

  stage("archive", { skill: "openspec-archive" });
});
