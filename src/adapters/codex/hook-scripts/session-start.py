#!/usr/bin/env python3
"""
Codex SessionStart Hook 脚本

查询 Pipeline Server，注入活跃流水线上下文。
输出格式与 Codex hookSpecificOutput 规范一致。
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

    try:
        req = urllib.request.Request(f"{SERVER}/api/v1/pipelines")
        with urllib.request.urlopen(req, timeout=2) as resp:
            pipelines = json.loads(resp.read())
    except Exception:
        return

    active = [p for p in pipelines if p.get("current_stage")]
    if not active:
        return

    lines = ["[AI Pipeline] Active pipelines:"]
    for p in active:
        s = p.get("stage_summary", {})
        lines.append(
            f"  - {p['id']}: stage={p.get('current_stage', '?')}, "
            f"{s.get('completed', 0)}/{s.get('total', 0)} stages done"
        )
    lines.append(f"Pipeline Server: {SERVER}")
    lines.append("Use curl to interact with the Pipeline Server API.")

    output = {
        "hookSpecificOutput": {
            "hookEventName": "SessionStart",
            "additionalContext": "\n".join(lines)
        }
    }
    print(json.dumps(output))


if __name__ == "__main__":
    main()
