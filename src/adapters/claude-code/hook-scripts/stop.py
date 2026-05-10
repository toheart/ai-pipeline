#!/usr/bin/env python3
"""
Claude Code Stop Hook 脚本

流水线未完成时阻止 Claude 停止，提示继续执行下一阶段。
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

    # 避免无限循环：如果已经被 Stop hook 触发过，不再拦截
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
        summary = p.get("stage_summary", {})
        total = summary.get("total", 0)
        completed = summary.get("completed", 0)
        if total > 0 and completed < total and summary.get("failed", 0) == 0:
            incomplete.append(p)

    if not incomplete:
        return

    reasons = []
    for p in incomplete:
        s = p.get("stage_summary", {})
        reasons.append(
            f"{p['id']}: {s.get('completed', 0)}/{s.get('total', 0)} stages completed, "
            f"current={p.get('current_stage', '?')}"
        )

    output = {
        "decision": "block",
        "reason": (
            "Pipeline not yet complete. Please continue execution.\n"
            + "\n".join(reasons)
        )
    }
    print(json.dumps(output))


if __name__ == "__main__":
    main()
