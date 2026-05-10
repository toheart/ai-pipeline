/**
 * Codex Hook 事件处理器
 *
 * Codex 的 Hook 系统与 Claude Code 高度相似，核心差异：
 *
 * | 特性                  | Claude Code                     | Codex                              |
 * |----------------------|----------------------------------|-------------------------------------|
 * | Hook 配置位置         | .claude/settings.json            | .codex/hooks.json                   |
 * | 启用方式              | 默认启用                         | 需要 config.toml [features] flag    |
 * | PermissionRequest     | 支持                             | 支持                                |
 * | 拦截范围              | Bash only                        | Bash only                           |
 * | exit code 2 + stderr  | 支持                             | 支持                                |
 * | Hook 特定输出         | hookSpecificOutput               | hookSpecificOutput（格式相同）       |
 * | Stop hook             | decision: "block" → 继续         | decision: "block" → 继续            |
 * | timeout 默认          | 未知                             | 600s                                |
 *
 * 由于 Codex 和 Claude Code 的 Hook 输出格式几乎一致，
 * 本模块的逻辑结构与 claude-code/hook-handler.ts 类似，
 * 但增加了 Codex 特有的 PermissionRequest 处理。
 */

import {
  advanceStage,
} from "../../engine/state-machine.ts";
import type { PipelineState, PipelineInstance } from "../../engine/types.ts";
import {
  extractPipelineId,
  extractStageFromCurl,
  type CodexHookEvent,
} from "./agent-resolver.ts";

// ─── Hook 输出类型（与 Codex 规范一致） ───

export interface CodexHookOutput {
  continue?: boolean;
  stopReason?: string;
  systemMessage?: string;
  suppressOutput?: boolean;
  hookSpecificOutput?: {
    hookEventName: string;
    additionalContext?: string;
    permissionDecision?: "allow" | "deny" | "ask";
    permissionDecisionReason?: string;
    decision?: {
      behavior: "allow" | "deny";
      message?: string;
    };
  };
  decision?: "block" | "approve";
  reason?: string;
}

// ─── SessionStart ───

export function handleSessionStart(
  event: CodexHookEvent,
  activePipelines: PipelineInstance[],
): CodexHookOutput {
  const active = activePipelines.filter(
    (p) => p.state.current_stage && p.state.change_name,
  );

  if (active.length === 0) return {};

  const contextParts = [
    `[AI Pipeline] Active pipelines:`,
    ...active.map(
      (p) => `  - ${p.id}: stage=${p.state.current_stage}, change=${p.state.change_name}`,
    ),
    `Pipeline Server: http://127.0.0.1:19090`,
    `Use curl to interact with the Pipeline Server API.`,
  ];

  return {
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: contextParts.join("\n"),
    },
  };
}

// ─── PreToolUse (Bash) ───

export function handlePreToolUse(event: CodexHookEvent): CodexHookOutput {
  const command = event.tool_input?.command ?? "";

  if (/git\s+push\s+.*(-f|--force)/.test(command)) {
    return {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: "Force push blocked by pipeline safety policy.",
      },
    };
  }

  if (/git\s+reset\s+--hard/.test(command)) {
    return {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason: "git reset --hard will discard uncommitted changes.",
      },
    };
  }

  if (/kubectl\s+apply.*prod|docker\s+push/.test(command)) {
    return {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason: "Production environment operation detected.",
      },
    };
  }

  return {};
}

// ─── PermissionRequest (Codex 特有) ───

export function handlePermissionRequest(event: CodexHookEvent): CodexHookOutput {
  const command = event.tool_input?.command ?? "";

  if (/rm\s+-rf\s+\/|mkfs|dd\s+if=/.test(command)) {
    return {
      hookSpecificOutput: {
        hookEventName: "PermissionRequest",
        decision: {
          behavior: "deny",
          message: "Destructive system command blocked by pipeline policy.",
        },
      },
    };
  }

  return {};
}

// ─── PostToolUse (Bash) ───

export function handlePostToolUse(
  event: CodexHookEvent,
  instance: PipelineInstance | null,
): { state: PipelineState | null; output: CodexHookOutput } {
  const command = event.tool_input?.command ?? "";

  if (!instance || !command.includes("127.0.0.1:19090")) {
    return { state: null, output: {} };
  }

  const curlInfo = extractStageFromCurl(command);
  const now = new Date().toISOString();
  let state: PipelineState | null = null;

  if (curlInfo.stage && curlInfo.status) {
    state = advanceStage(
      instance.state,
      curlInfo.stage,
      curlInfo.status as any,
      now,
    );
  }

  return {
    state,
    output: state
      ? {
          hookSpecificOutput: {
            hookEventName: "PostToolUse",
            additionalContext: `Pipeline stage "${curlInfo.stage}" → ${curlInfo.status}`,
          },
        }
      : {},
  };
}

// ─── UserPromptSubmit ───

export function handleUserPromptSubmit(
  event: CodexHookEvent,
  activePipelines: PipelineInstance[],
): CodexHookOutput {
  if (activePipelines.length === 0) return {};

  const pipelineId = extractPipelineId(event);
  if (pipelineId) {
    const inst = activePipelines.find((p) => p.id === pipelineId);
    if (inst) {
      return {
        hookSpecificOutput: {
          hookEventName: "UserPromptSubmit",
          additionalContext: `Pipeline ${inst.id} is at stage "${inst.state.current_stage}".`,
        },
      };
    }
  }

  return {};
}

// ─── Stop ───

export function handleStop(
  event: CodexHookEvent,
  activePipelines: PipelineInstance[],
): CodexHookOutput {
  if (event.stop_hook_active) return {};

  const incomplete = activePipelines.filter((p) => {
    const hasActive = p.state.stages.some((s) => s.status === "active" || s.status === "pending");
    const noFailed = !p.state.stages.some((s) => s.status === "failed");
    return hasActive && noFailed && p.state.current_stage;
  });

  if (incomplete.length === 0) return {};

  const reasons = incomplete.map((p) => {
    const done = p.state.stages.filter((s) => s.status === "completed" || s.status === "skipped").length;
    return `${p.id}: ${done}/${p.state.stages.length} stages done, current="${p.state.current_stage}"`;
  });

  return {
    decision: "block",
    reason: `Pipeline not yet complete. Continue execution.\n${reasons.join("\n")}`,
  };
}
