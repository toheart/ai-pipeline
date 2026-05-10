/**
 * ai-pipeline status — 查看当前 pipeline 实例状态
 */

const SERVER_BASE = "http://127.0.0.1:19090";

export async function runStatus(_args: string[]): Promise<void> {
  try {
    const res = await fetch(`${SERVER_BASE}/api/v1/pipelines`);
    if (!res.ok) {
      console.error(`Server returned ${res.status}. Is the pipeline server running?`);
      console.error(`  Start it with: npx ai-pipeline serve`);
      process.exit(1);
    }

    const pipelines = await res.json() as any[];
    if (pipelines.length === 0) {
      console.log("No active pipelines.");
      return;
    }

    console.log(`\n  ${"Pipeline".padEnd(35)} ${"Stage".padEnd(20)} ${"Progress"}`);
    console.log(`  ${"─".repeat(35)} ${"─".repeat(20)} ${"─".repeat(15)}`);

    for (const p of pipelines) {
      const { id, current_stage, stage_summary: s } = p;
      const progress = `${s.completed}/${s.total}`;
      const bar = renderBar(s.completed, s.active, s.total - s.completed - s.active - (s.failed ?? 0), s.failed ?? 0);
      console.log(`  ${id.padEnd(35)} ${(current_stage || "idle").padEnd(20)} ${progress} ${bar}`);
    }
    console.log();
  } catch {
    console.error("Cannot connect to pipeline server at " + SERVER_BASE);
    console.error("  Start it with: npx ai-pipeline serve");
    process.exit(1);
  }
}

function renderBar(done: number, active: number, pending: number, failed: number): string {
  const g = "█".repeat(done);
  const b = "▓".repeat(active);
  const r = "░".repeat(failed);
  const d = "░".repeat(pending);
  return `[${g}${b}${r}${d}]`;
}
