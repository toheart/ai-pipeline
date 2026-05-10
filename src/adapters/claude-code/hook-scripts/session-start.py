#!/usr/bin/env python3
"""
Claude Code SessionStart Hook 脚本

读取 stdin JSON → 查询 Pipeline Server → 输出 additionalContext
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

    context_parts = ["[AI Pipeline] Active pipelines:"]
    for p in active:
        summary = p.get("stage_summary", {})
        context_parts.append(
            f"  - {p['id']}: stage={p.get('current_stage', '?')}, "
            f"completed={summary.get('completed', 0)}/{summary.get('total', 0)}"
        )
    context_parts.append(f"Pipeline Server: {SERVER}")
    context_parts.append("Use curl to interact with the Pipeline Server API.")

    output = {
        "hookSpecificOutput": {
            "hookEventName": "SessionStart",
            "additionalContext": "\n".join(context_parts)
        }
    }
    print(json.dumps(output))


if __name__ == "__main__":
    main()
