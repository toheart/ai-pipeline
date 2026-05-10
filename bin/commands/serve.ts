/**
 * ai-pipeline serve [--port] — 启动 Pipeline Server + Dashboard
 */

import { parseArgs } from "node:util";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export async function runServe(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      port: { type: "string", default: "19090" },
      "templates-dir": { type: "string" },
      "manifests-dir": { type: "string" },
    },
    strict: false,
  });

  const port = values.port ?? "19090";
  const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const dashboardDir = join(pkgRoot, "dashboard", "dist");

  process.env.PIPELINE_PORT = String(port);
  process.env.DASHBOARD_DIR = dashboardDir;

  if (values["templates-dir"]) {
    process.argv.push("--templates-dir", values["templates-dir"] as string);
  }
  if (values["manifests-dir"]) {
    process.argv.push("--manifests-dir", values["manifests-dir"] as string);
  }

  await import("../../src/server/pipeline-server.ts");
}
