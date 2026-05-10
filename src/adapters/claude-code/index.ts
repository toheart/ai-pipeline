/**
 * Claude Code 适配器公共导出
 */

export { ClaudeCodeRuntime } from "./runtime.ts";
export type { ClaudeCodeRuntimeConfig } from "./runtime.ts";
export {
  handleSessionStart,
  handlePreToolUse,
  handlePostToolUse,
  handleUserPromptSubmit,
  handleStop,
} from "./hook-handler.ts";
export type { HookOutput } from "./hook-handler.ts";
export {
  extractAgentFromCommand,
  extractPipelineId,
  extractStageFromCurl,
  inferStageFromPrompt,
} from "./agent-resolver.ts";
export type { ClaudeCodeHookEvent } from "./agent-resolver.ts";
