/**
 * Codex 适配器公共导出
 */

export { CodexRuntime } from "./runtime.ts";
export type { CodexRuntimeConfig } from "./runtime.ts";
export {
  handleSessionStart,
  handlePreToolUse,
  handlePermissionRequest,
  handlePostToolUse,
  handleUserPromptSubmit,
  handleStop,
} from "./hook-handler.ts";
export type { CodexHookOutput } from "./hook-handler.ts";
export {
  extractPipelineId,
  extractStageFromCurl,
  extractAgentFromPrompt,
  inferStageFromPrompt,
} from "./agent-resolver.ts";
export type { CodexHookEvent } from "./agent-resolver.ts";
