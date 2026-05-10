/**
 * Pipeline Server —— 薄壳 HTTP 服务（Node.js 原生实现）
 *
 * 职责：REST API + WebSocket 实时推送 + Dashboard 静态文件
 * 不包含任何 IDE 特定逻辑（Hook 处理在 Adapter 层）
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, resolve, extname } from "node:path";
import { parseArgs } from "node:util";
import { WebSocketServer, WebSocket } from "ws";
import {
  createInitialState,
  advanceStage,
  resolveGate,
} from "../engine/state-machine.ts";
import { loadTemplate, findTemplate, listTemplateFiles } from "../engine/template-loader.ts";
import type { PipelineState, PipelineInstance, TemplateConfig, PipelineManifest } from "../engine/types.ts";
import { appendAudit, readRecentAudit } from "./audit.ts";

// ─── 配置 ───

const PORT = parseInt(process.env.PIPELINE_PORT ?? "19090") || 19090;
const DATA_DIR = ".cursor/hooks/state";
const AUDIT_FILE = join(DATA_DIR, "audit.jsonl");

mkdirSync(DATA_DIR, { recursive: true });

const { values: cliArgs } = parseArgs({
  options: {
    "templates-dir": { type: "string" },
    "pipelines-dir": { type: "string" },
    "manifests-dir": { type: "string" },
  },
  strict: false,
});

const TEMPLATES_DIR = (cliArgs["templates-dir"] as string) ?? "templates";
const PIPELINES_DIR = (cliArgs["pipelines-dir"] as string) ?? ".cursor/pipelines";
const MANIFESTS_DIR = (cliArgs["manifests-dir"] as string) ?? ".cursor/manifests";

mkdirSync(PIPELINES_DIR, { recursive: true });
mkdirSync(MANIFESTS_DIR, { recursive: true });

// ─── Pipeline 实例管理 ───

const pipelinesMap = new Map<string, PipelineInstance>();

function stateFilePath(id: string): string {
  return join(DATA_DIR, `pipeline-${id}.json`);
}

function loadPipelineState(filePath: string): PipelineState | null {
  try {
    return JSON.parse(readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function savePipelineState(inst: PipelineInstance): void {
  writeFileSync(inst.stateFile, JSON.stringify(inst.state, null, 2));
}

function loadPipeline(id: string): PipelineInstance | null {
  if (pipelinesMap.has(id)) return pipelinesMap.get(id)!;

  const sf = stateFilePath(id);
  const saved = loadPipelineState(sf);
  if (!saved?._template_name) return null;

  const template = findTemplate(saved._template_name, [TEMPLATES_DIR, PIPELINES_DIR]);
  if (!template) return null;

  const inst: PipelineInstance = { id, template, state: saved, stateFile: sf };
  pipelinesMap.set(id, inst);
  return inst;
}

function createPipeline(id: string, template: TemplateConfig): PipelineInstance {
  const sf = stateFilePath(id);
  const state = createInitialState(id, template);
  const inst: PipelineInstance = { id, template, state, stateFile: sf };
  pipelinesMap.set(id, inst);
  savePipelineState(inst);
  return inst;
}

function discoverPipelines(): PipelineInstance[] {
  try {
    const files = readdirSync(DATA_DIR).filter(
      (f) => f.startsWith("pipeline-") && f.endsWith(".json"),
    );
    for (const f of files) {
      const id = f.replace(/^pipeline-/, "").replace(/\.json$/, "");
      if (!pipelinesMap.has(id)) loadPipeline(id);
    }
  } catch {}
  return [...pipelinesMap.values()];
}

function getActivePipeline(url: URL): PipelineInstance | null {
  const id = url.searchParams.get("pipeline");
  if (id) return loadPipeline(id) ?? null;

  const all = discoverPipelines();
  return all.length === 1 ? all[0] : null;
}

discoverPipelines();

// ─── Manifest 管理 ───

function loadManifest(name: string): PipelineManifest | null {
  const fp = join(MANIFESTS_DIR, `${name}.manifest.json`);
  try {
    return JSON.parse(readFileSync(fp, "utf-8"));
  } catch {
    return null;
  }
}

function listManifests(): PipelineManifest[] {
  try {
    return readdirSync(MANIFESTS_DIR)
      .filter((f) => f.endsWith(".manifest.json"))
      .map((f) => {
        try {
          return JSON.parse(readFileSync(join(MANIFESTS_DIR, f), "utf-8"));
        } catch {
          return null;
        }
      })
      .filter(Boolean) as PipelineManifest[];
  } catch {
    return [];
  }
}

// ─── WebSocket ───

const wsClients = new Set<WebSocket>();

function broadcast(type: string, data: unknown): void {
  const msg = JSON.stringify({ type, data });
  for (const ws of wsClients) {
    try {
      if (ws.readyState === WebSocket.OPEN) ws.send(msg);
    } catch {
      wsClients.delete(ws);
    }
  }
}

// ─── Dashboard 静态文件 ───

const DASHBOARD_DIR_CANDIDATES = [
  process.env.DASHBOARD_DIR,
  resolve("dashboard/dist"),
].filter(Boolean) as string[];

const DASHBOARD_DIR = DASHBOARD_DIR_CANDIDATES.find(
  (d) => existsSync(d) && existsSync(join(d, "index.html")),
);

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function serveDashboardFile(res: ServerResponse, pathname: string): boolean {
  if (!DASHBOARD_DIR) return false;

  let filePath: string;
  if (pathname === "/" || pathname === "/dashboard") {
    filePath = join(DASHBOARD_DIR, "index.html");
  } else {
    filePath = join(DASHBOARD_DIR, pathname);
  }

  if (!existsSync(filePath)) return false;

  try {
    const content = readFileSync(filePath);
    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
    return true;
  } catch {
    return false;
  }
}

// ─── 工具函数 ───

function sendJson(res: ServerResponse, data: unknown, status = 200): void {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(body);
}

function sendHtml(res: ServerResponse, html: string, status = 200): void {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf-8")));
      } catch {
        reject(new Error("invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

// ─── HTTP Server ───

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
  const method = req.method ?? "GET";

  // CORS preflight
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  try {
    // Dashboard 首页
    if ((url.pathname === "/" || url.pathname === "/dashboard") && method === "GET") {
      if (serveDashboardFile(res, "/")) return;
      sendHtml(res, "<html><body><h1>Dashboard not found</h1><p>Run: cd dashboard && npm run build</p></body></html>");
      return;
    }

    // 健康检查
    if (url.pathname === "/healthz" && method === "GET") {
      sendJson(res, {
        status: "ok",
        pipelines: discoverPipelines().map((p) => ({
          id: p.id,
          template: p.template.name,
        })),
      });
      return;
    }

    // ── Hook 入口 ──
    if (url.pathname === "/api/v1/pipeline/hook" && method === "POST") {
      await readBody(req).catch(() => {});
      sendJson(res, {});
      return;
    }

    // ── Manifest API ──
    if (url.pathname === "/api/v1/manifests" && method === "GET") {
      sendJson(res, listManifests());
      return;
    }

    if (url.pathname.startsWith("/api/v1/manifests/") && method === "GET") {
      const name = url.pathname.split("/").pop() ?? "";
      const manifest = loadManifest(name);
      if (!manifest) { sendJson(res, { error: "manifest not found" }, 404); return; }
      sendJson(res, manifest);
      return;
    }

    // ── Pipeline 实例管理 ──
    if (url.pathname === "/api/v1/pipelines" && method === "GET") {
      const all = discoverPipelines();
      sendJson(res, all.map((p) => ({
        id: p.id,
        template: p.template.name,
        description: p.template.description,
        change_name: p.state.change_name,
        current_stage: p.state.current_stage,
        started_at: p.state.started_at,
        stage_summary: {
          total: p.state.stages.length,
          completed: p.state.stages.filter((s) => s.status === "completed").length,
          active: p.state.stages.filter((s) => s.status === "active").length,
          failed: p.state.stages.filter((s) => s.status === "failed").length,
        },
      })));
      return;
    }

    if (url.pathname === "/api/v1/pipelines" && method === "POST") {
      const body = await readBody(req).catch(() => null) as { id?: string; template: string; change_name?: string } | null;
      if (!body?.template) { sendJson(res, { error: "template is required" }, 400); return; }

      const tpl = findTemplate(body.template, [TEMPLATES_DIR, PIPELINES_DIR]);
      if (!tpl) { sendJson(res, { error: `template '${body.template}' not found` }, 404); return; }

      const pipelineId = body.id ?? (body.change_name ? `${tpl.name}--${body.change_name}` : tpl.name);
      const existing = loadPipeline(pipelineId);
      if (existing) {
        sendJson(res, { status: "ok", id: existing.id, template: tpl.name, change_name: existing.state.change_name, resumed: true });
        return;
      }

      const inst = createPipeline(pipelineId, tpl);
      if (body.change_name) {
        inst.state.change_name = body.change_name;
        inst.state.started_at = new Date().toISOString();
        savePipelineState(inst);
      }
      broadcast("pipeline_created", { id: inst.id, template: tpl.name });
      appendAudit(AUDIT_FILE, "pipeline_created", "", inst.id, inst.id);
      sendJson(res, { status: "ok", id: inst.id, template: tpl.name, change_name: inst.state.change_name, resumed: false });
      return;
    }

    // 重置
    if (url.pathname === "/api/v1/pipelines/reset" && method === "POST") {
      const body = await readBody(req).catch(() => null) as { id: string } | null;
      if (!body?.id) { sendJson(res, { error: "id is required" }, 400); return; }
      const inst = loadPipeline(body.id);
      if (!inst) { sendJson(res, { error: "not found" }, 404); return; }
      inst.state = createInitialState(inst.id, inst.template);
      savePipelineState(inst);
      broadcast("pipeline_reset", { id: inst.id });
      sendJson(res, { status: "reset", id: inst.id });
      return;
    }

    // ── 单 Pipeline 操作 ──
    if (url.pathname === "/api/v1/pipeline/state" && method === "GET") {
      const inst = getActivePipeline(url);
      if (!inst) { sendJson(res, { error: "no pipeline found" }, 404); return; }
      sendJson(res, inst.state);
      return;
    }

    if (url.pathname === "/api/v1/pipeline/stage" && method === "POST") {
      const body = await readBody(req).catch(() => null) as { stage: string; status: string; pipeline?: string } | null;
      if (!body) { sendJson(res, { error: "invalid body" }, 400); return; }

      const id = body.pipeline ?? url.searchParams.get("pipeline");
      const inst = id ? loadPipeline(id) : getActivePipeline(url);
      if (!inst) { sendJson(res, { error: "no pipeline found" }, 404); return; }

      const validStatus = ["active", "completed", "failed", "skipped"];
      if (!body.stage || !validStatus.includes(body.status)) {
        sendJson(res, { error: "invalid stage or status" }, 400); return;
      }

      const now = new Date().toISOString();
      inst.state = advanceStage(inst.state, body.stage, body.status as any, now);
      savePipelineState(inst);
      broadcast("stage_updated", { pipeline_id: inst.id, stage: body.stage, status: body.status });
      appendAudit(AUDIT_FILE, `stage_${body.status}`, "", body.stage, inst.id);
      sendJson(res, { status: "ok", pipeline_id: inst.id, stage: body.stage });
      return;
    }

    if (url.pathname === "/api/v1/pipeline/gate" && method === "POST") {
      const body = await readBody(req).catch(() => null) as { gate: string; result: string; pipeline?: string; comment?: string } | null;
      if (!body) { sendJson(res, { error: "invalid body" }, 400); return; }

      const id = body.pipeline ?? url.searchParams.get("pipeline");
      const inst = id ? loadPipeline(id) : getActivePipeline(url);
      if (!inst) { sendJson(res, { error: "no pipeline found" }, 404); return; }

      if (body.result !== "passed" && body.result !== "failed") {
        sendJson(res, { error: "result must be 'passed' or 'failed'" }, 400); return;
      }

      const now = new Date().toISOString();
      inst.state = resolveGate(inst.state, body.gate, body.result, now, body.comment);
      savePipelineState(inst);
      broadcast("gate_decided", { pipeline_id: inst.id, gate: body.gate, result: body.result });
      appendAudit(AUDIT_FILE, `gate_${body.result}`, "", body.gate, inst.id);
      sendJson(res, { status: "ok", pipeline_id: inst.id, gate: body.gate });
      return;
    }

    if (url.pathname === "/api/v1/pipeline/change" && method === "POST") {
      const body = await readBody(req).catch(() => null) as { name: string; pipeline?: string } | null;
      if (!body) { sendJson(res, { error: "invalid body" }, 400); return; }

      const id = body.pipeline ?? url.searchParams.get("pipeline");
      const inst = id ? loadPipeline(id) : getActivePipeline(url);
      if (!inst) { sendJson(res, { error: "no pipeline found" }, 404); return; }

      inst.state.change_name = body.name ?? "";
      if (!inst.state.started_at) inst.state.started_at = new Date().toISOString();
      savePipelineState(inst);
      broadcast("change_updated", { pipeline_id: inst.id, name: inst.state.change_name });
      sendJson(res, { status: "ok", pipeline_id: inst.id, change_name: inst.state.change_name });
      return;
    }

    // 模板列表
    if (url.pathname === "/api/v1/pipeline/templates" && method === "GET") {
      const all: { name: string; description: string; file: string }[] = [];
      for (const dir of [TEMPLATES_DIR, PIPELINES_DIR]) {
        for (const f of listTemplateFiles(dir)) {
          try {
            const t = loadTemplate(join(dir, f));
            all.push({ name: t.name, description: t.description, file: f });
          } catch {}
        }
      }
      sendJson(res, all);
      return;
    }

    // 审计日志
    if (url.pathname === "/api/v1/pipeline/audit" && method === "GET") {
      const limit = parseInt(url.searchParams.get("limit") ?? "20") || 20;
      const pid = url.searchParams.get("pipeline") ?? undefined;
      sendJson(res, readRecentAudit(AUDIT_FILE, limit, pid));
      return;
    }

    // 阶段定义 + 运行时状态合并
    if (url.pathname === "/api/v1/pipeline/stages" && method === "GET") {
      const inst = getActivePipeline(url);
      if (!inst) { sendJson(res, { error: "no pipeline found" }, 404); return; }

      const manifest = loadManifest(inst.template.name);
      const stageMap = new Map(inst.state.stages.map((s) => [s.name, s]));

      const merged = (manifest?.stages ?? inst.template.stages).map((def: any) => ({
        name: def.name,
        label: def.label ?? def.name,
        agent: def.agent,
        skill: def.skill,
        gate: def.gate ?? false,
        gate_description: def.gate_description ?? def.gateDescription,
        optional: def.optional ?? false,
        parallel: def.parallel,
        status: stageMap.get(def.name)?.status ?? "pending",
        started_at: stageMap.get(def.name)?.started_at,
        completed_at: stageMap.get(def.name)?.completed_at,
        duration_ms: stageMap.get(def.name)?.duration_ms,
      }));

      sendJson(res, merged);
      return;
    }

    // 待决策 Gate 列表
    if (url.pathname === "/api/v1/pipeline/pending-gates" && method === "GET") {
      const inst = getActivePipeline(url);
      if (!inst) { sendJson(res, { error: "no pipeline found" }, 404); return; }

      const stageMap = new Map(inst.state.stages.map((s) => [s.name, s]));
      const gateMap = new Map(inst.state.gates.map((g) => [g.name, g]));

      const manifest = loadManifest(inst.template.name);
      const stageDefs = manifest?.stages ?? inst.template.stages;

      const pending: { name: string; description: string; previous_stage?: string }[] = [];
      for (let i = 0; i < stageDefs.length; i++) {
        const def = stageDefs[i] as any;
        if (!def.gate && !def.gate_description) continue;

        const gate = gateMap.get(def.name);
        if (gate && gate.result !== "pending") continue;

        const runtimeStage = stageMap.get(def.name);
        if (runtimeStage?.status === "completed" || runtimeStage?.status === "skipped") continue;

        const prevDef = i > 0 ? stageDefs[i - 1] : null;
        const prevRuntime = prevDef ? stageMap.get((prevDef as any).name) : null;
        const prevCompleted = !prevDef || prevRuntime?.status === "completed" || prevRuntime?.status === "skipped";

        if (prevCompleted) {
          pending.push({
            name: def.name,
            description: def.gate_description ?? def.gateDescription ?? def.label ?? def.name,
            previous_stage: prevDef ? (prevDef as any).name : undefined,
          });
        }
      }

      sendJson(res, pending);
      return;
    }

    // Dashboard 静态资源 fallback
    if (serveDashboardFile(res, url.pathname)) return;

    // SPA fallback — 非 API 路径返回 index.html
    if (!url.pathname.startsWith("/api/")) {
      if (serveDashboardFile(res, "/")) return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  } catch (err) {
    console.error("Request error:", err);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Internal Server Error");
  }
});

// ─── WebSocket Server ───

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws) => {
  wsClients.add(ws);
  ws.on("close", () => wsClients.delete(ws));
  ws.on("error", () => wsClients.delete(ws));
});

// ─── 启动 ───

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Pipeline server: http://127.0.0.1:${PORT}/`);
  console.log(`Dashboard:       ${DASHBOARD_DIR ?? "(not found)"}`);
  console.log(`Templates:       ${TEMPLATES_DIR}`);
  console.log(`Pipelines:       ${PIPELINES_DIR}`);
  console.log(`Manifests:       ${MANIFESTS_DIR}`);
  console.log(`Instances:       ${discoverPipelines().map((p) => p.id).join(", ") || "(none)"}`);
  console.log();
});
