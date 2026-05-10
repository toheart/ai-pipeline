/**
 * 各 IDE adapter 的目录约定
 *
 * 所有需要读写 IDE 特定目录的模块（generate / init / serve）
 * 统一通过此模块获取路径，避免硬编码分散在各处。
 */

export type AdapterName = "cursor" | "claude-code" | "codex";

export const VALID_ADAPTERS: readonly AdapterName[] = ["cursor", "claude-code", "codex"];

export interface AdapterPaths {
  /** IDE 配置根目录（如 .cursor / .claude / .codex） */
  configRoot: string;
  /** Agent 定义文件目录 */
  agentsDir: string;
  /** Agent 定义文件扩展名 */
  agentFileExt: string;
  /** 编译产出的 manifest 目录 */
  manifestsDir: string;
  /** 生成的 Orchestrator Skill 目录 */
  skillsDir: string;
  /** Hook 脚本和状态文件目录 */
  hooksDir: string;
  /** Hook 配置文件路径 */
  hooksConfig: string;
  /** Pipeline 模板副本目录 */
  pipelinesDir: string;
  /** 状态文件目录 */
  stateDir: string;
  /** 全局配置文件（CLAUDE.md / AGENTS.md / config.toml） */
  globalConfig: string;
  /** Agent 调度工具名称 */
  agentToolName: string;
}

const CURSOR_PATHS: AdapterPaths = {
  configRoot: ".cursor",
  agentsDir: ".cursor/agents",
  agentFileExt: ".md",
  manifestsDir: ".cursor/manifests",
  skillsDir: ".cursor/skills",
  hooksDir: ".cursor/hooks",
  hooksConfig: ".cursor/hooks.json",
  pipelinesDir: ".cursor/pipelines",
  stateDir: ".cursor/hooks/state",
  globalConfig: ".cursor/rules",
  agentToolName: "Task tool",
};

const CLAUDE_CODE_PATHS: AdapterPaths = {
  configRoot: ".claude",
  agentsDir: ".claude/agents",
  agentFileExt: ".md",
  manifestsDir: ".claude/manifests",
  skillsDir: ".claude/skills",
  hooksDir: ".claude/hooks",
  hooksConfig: ".claude/settings.json",
  pipelinesDir: ".claude/pipelines",
  stateDir: ".claude/hooks/state",
  globalConfig: "CLAUDE.md",
  agentToolName: "Agent tool",
};

const CODEX_PATHS: AdapterPaths = {
  configRoot: ".codex",
  agentsDir: ".codex/agents",
  agentFileExt: ".toml",
  manifestsDir: ".codex/manifests",
  skillsDir: ".codex/skills",
  hooksDir: ".codex/hooks",
  hooksConfig: ".codex/hooks.json",
  pipelinesDir: ".codex/pipelines",
  stateDir: ".codex/hooks/state",
  globalConfig: "AGENTS.md",
  agentToolName: "spawn agent",
};

const ADAPTER_PATHS: Record<AdapterName, AdapterPaths> = {
  cursor: CURSOR_PATHS,
  "claude-code": CLAUDE_CODE_PATHS,
  codex: CODEX_PATHS,
};

export function getAdapterPaths(adapter: string): AdapterPaths {
  const name = adapter as AdapterName;
  const paths = ADAPTER_PATHS[name];
  if (!paths) {
    throw new Error(
      `Unknown adapter "${adapter}". Valid adapters: ${VALID_ADAPTERS.join(", ")}`,
    );
  }
  return paths;
}

export function isValidAdapter(adapter: string): adapter is AdapterName {
  return VALID_ADAPTERS.includes(adapter as AdapterName);
}
