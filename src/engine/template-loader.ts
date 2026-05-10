/**
 * 模板加载器 —— 从 YAML 文件加载 Pipeline 模板
 *
 * 平台无关，不依赖任何 IDE 能力。
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseYaml, replaceVars } from "./yaml-parser.ts";
import type { TemplateConfig, StageDef } from "./types.ts";

export function collectAgentRefs(stages: StageDef[]): string[] {
  const refs = new Set<string>();
  for (const s of stages) {
    if (s.agent) refs.add(s.agent);
    if (Array.isArray(s.parallel)) {
      for (const p of s.parallel) {
        if (p.agent) refs.add(p.agent);
      }
    }
  }
  return [...refs];
}

export function loadTemplate(filePath: string): TemplateConfig {
  const content = readFileSync(filePath, "utf-8");
  const raw = parseYaml(content);

  const variables = raw.variables ?? {};
  const rawStages: StageDef[] = (raw.stages ?? []).map((s: any) => ({
    name: s.name,
    label: replaceVars(s.label ?? s.name, variables),
    agent: s.agent,
    skill: s.skill,
    gate: s.gate === true,
    gate_description: s.gate_description,
    optional: s.optional === true,
    parallel: Array.isArray(s.parallel)
      ? s.parallel.map((p: any) => ({
          agent: p.agent,
          scope: replaceVars(p.scope ?? "", variables),
        }))
      : undefined,
    on_fail: s.on_fail,
    retries: s.retries,
  }));

  return {
    name: raw.name ?? "",
    description: raw.description ?? "",
    variables,
    stages: rawStages,
    agentRefs: collectAgentRefs(rawStages),
    raw,
  };
}

export function listTemplateFiles(dir: string): string[] {
  try {
    return readdirSync(dir).filter(
      (f) => f.endsWith(".yaml") || f.endsWith(".yml"),
    );
  } catch {
    return [];
  }
}

export function findTemplate(
  nameOrPath: string,
  searchDirs: string[],
): TemplateConfig | null {
  if (existsSync(nameOrPath)) return loadTemplate(nameOrPath);

  for (const dir of searchDirs) {
    for (const ext of ["yaml", "yml"]) {
      const fp = join(dir, `${nameOrPath}.${ext}`);
      if (existsSync(fp)) return loadTemplate(fp);
    }
    const fp = join(dir, nameOrPath);
    if (existsSync(fp)) return loadTemplate(fp);
  }
  return null;
}
