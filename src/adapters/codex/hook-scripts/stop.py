#!/usr/bin/env python3
"""
Codex Stop Hook 脚本

流水线未完成时阻止 Codex 停止，提示继续执行。
Codex 中 decision: "block" 会创建一个新的 continuation prompt。
"""
import json
import sys
import urllib.request

SERVER = "http://127.0.0.1:19090"


def main():
    try:
        event = json.load(sys.stdin)
    except Exception:
        return

    if event.get("stop_hook_active"):
        return

    try:
        req = urllib.request.Request(f"{SERVER}/api/v1/pipelines")
        with urllib.request.urlopen(req, timeout=2) as resp:
            pipelines = json.loads(resp.read())
    except Exception:
        return

    incomplete = []
    for p in pipelines:
        s = p.get("stage_summary", {})
        total = s.get("total", 0)
        completed = s.get("completed", 0)
        failed = s.get("failed", 0)
        if total > 0 and completed < total and failed == 0:
            incomplete.append(p)

    if not incomplete:
        return

    reasons = []
    for p in incomplete:
        s = p.get("stage_summary", {})
        reasons.append(
            f"{p['id']}: {s.get('completed', 0)}/{s.get('total', 0)} done, "
            f"current={p.get('current_stage', '?')}"
        )

    output = {
        "decision": "block",
        "reason": "Pipeline not yet complete. Continue execution.\n" + "\n".join(reasons)
    }
    print(json.dumps(output))


if __name__ == "__main__":
    main()
