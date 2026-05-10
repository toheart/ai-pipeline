/**
 * Claude Code Hook 事件处理器
 *
 * Claude Code 的 Hook 系统与 Cursor 的区别：
 *
 * | 特性             | Cursor               | Claude Code                          |
 * |------------------|----------------------|--------------------------------------|
 * | Hook 配置文件     | hooks.json           | .claude/settings.json 或 hooks.json  |
 * | Agent 启动事件    | subagentStart        | 无直接等价（通过 PreToolUse 拦截）    |
 * | Agent 停止事件    | subagentStop         | 无直接等价（通过 Stop hook 拦截）     |
 * | Shell 拦截        | beforeShellExecution | PreToolUse (tool_name=Bash)          |
 * | Shell 后处理      | afterShellExecution  | PostToolUse (tool_name=Bash)         |
 * | 会话启动          | sessionStart         | SessionStart                         |
 * | 用户输入拦截      | 无                   | UserPromptSubmit                     |
 * | 权限请求          | 无                   | PermissionRequest                    |
 * | 输出格式          | JSON stdout          | JSON stdout / exit code 2 + stderr   |
 *
 * Hook 输出约定：
 * - exit 0 + JSON stdout → 正常处理
 * - exit 2 + stderr → 阻止操作，stderr 内容返回给 Claude
 * - exit 0 无输出 → 视为成功，继续
 */

import {
  advanceStage,
  addActiveAgent,
  completeAgent,
} from "../../engine/state-machine.ts";
import type { PipelineState, PipelineInstance } from "../../engine/types.ts";
import {
  extractPipelineId,
  extractStageFromCurl,
  extractAgentFromCommand,
  type ClaudeCodeHookEvent,
} from "./agent-resolver.ts";

// ─── Hook 输出类型 ───

export interface HookOutput {
  /** 标准字段 */
  continue?: boolean;
  stopReason?: string;
  systemMessage?: string;
  suppressOutput?: boolean;
  /** Hook 特定输出 */
  hookSpecificOutput?: {
    hookEventName: string;
    additionalContext?: string;
    permissionDecision?: "allow" | "deny" | "ask";
    permissionDecisionReason?: string;
  };
  /** 兼容格式 */
  decision?: "block" | "approve";
  reason?: string;
}

// ─── SessionStart ───

export function handleSessionStart(
  event: ClaudeCodeHookEvent,
  activePipelines: PipelineInstance[],
): HookOutput {
  const active = activePipelines.filter(
    (p) => p.state.current_stage && p.state.change_name,
  );

  const contextParts: string[] = [];
  if (active.length > 0) {
    contextParts.push(
      `[AI Pipeline 活跃流水线] ${active.map((p) => `${p.id}(${p.state.change_name}@${p.state.current_stage})`).join(", ")}`,
    );
    contextParts.push(
      `Pipeline Server: http://127.0.0.1:19090`,
    );
    contextParts.push(
      `请通过 curl 与 Pipeline Server 交互来更新阶段状态。`,
    );
  }

  if (contextParts.length === 0) return {};

  return {
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: contextParts.join("\n"),
    },
  };
}

// ─── PreToolUse (Bash) ───

export function handlePreToolUse(
  event: ClaudeCodeHookEvent,
  activePipelines: PipelineInstance[],
): HookOutput {
  const command = event.tool_input?.command ?? "";

  if (/git\s+push\s+.*(-f|--force)/.test(command)) {
    return {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: "Force push 已被流水线安全策略拦截。",
      },
    };
  }

  if (/git\s+reset\s+--hard/.test(command)) {
    return {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason: "git reset --hard 会丢失未提交的变更。",
      },
    };
  }

  if (/kubectl\s+apply.*prod|docker\s+push/.test(command)) {
    return {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason: "检测到生产环境操作，请确认。",
      },
    };
  }

  return {};
}

// ─── PostToolUse (Bash) ───

/**
 * PostToolUse 中监控 curl 调用 Pipeline Server 的命令，
 * 从中提取 stage/gate 状态更新。
 *
 * Claude Code 中没有 subagentStart/subagentStop 直接事件，
 * 因此通过监控 Bash 命令中对 Pipeline Server 的 API 调用来跟踪进度。
 */
export function handlePostToolUse(
  event: ClaudeCodeHookEvent,
  instance: PipelineInstance | null,
): { state: PipelineState | null; output: HookOutput } {
  const command = event.tool_input?.command ?? "";

  if (!instance) {
    return { state: null, output: {} };
  }

  if (!command.includes("127.0.0.1:19090") && !command.includes("pipeline")) {
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
  event: ClaudeCodeHookEvent,
  activePipelines: PipelineInstance[],
): HookOutput {
  const prompt = event.prompt ?? "";

  if (activePipelines.length > 0) {
    const pipelineId = extractPipelineId(event);
    if (pipelineId) {
      const inst = activePipelines.find((p) => p.id === pipelineId);
      if (inst) {
        return {
          hookSpecificOutput: {
            hookEventName: "UserPromptSubmit",
            additionalContext: `当前流水线 ${inst.id} 处于 ${inst.state.current_stage} 阶段。`,
          },
        };
      }
    }
  }
  return {};
}

// ─── Stop ───

export function handleStop(
  event: ClaudeCodeHookEvent,
  activePipelines: PipelineInstance[],
): HookOutput {
  const active = activePipelines.filter(
    (p) =>
      p.state.current_stage &&
      !p.state.stages.every(
        (s) => s.status === "completed" || s.status === "skipped",
      ),
  );

  if (active.length === 0) return {};

  const nextStages = active.map((p) => {
    const currentIdx = p.state.stages.findIndex(
      (s) => s.name === p.state.current_stage,
    );
    const next = p.state.stages.find(
      (s, i) => i > currentIdx && s.status === "pending",
    );
    return next ? `${p.id}: 下一阶段 → ${next.name}` : null;
  }).filter(Boolean);

  if (nextStages.length === 0) return {};

  return {
    decision: "block",
    reason: `流水线尚未完成。${nextStages.join("; ")}。请继续执行下一阶段。`,
  };
}
