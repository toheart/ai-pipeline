#!/usr/bin/env python3
"""
Codex PostToolUse Hook 脚本

监控 Bash 命令中对 Pipeline Server 的 API 调用。
"""
import json
import re
import sys


def main():
    try:
        event = json.load(sys.stdin)
    except Exception:
        return

    command = (event.get("tool_input") or {}).get("command", "")
    if "127.0.0.1:19090" not in command:
        return

    stage_match = re.search(r'"stage"\s*:\s*"([^"]+)"', command)
    status_match = re.search(r'"status"\s*:\s*"([^"]+)"', command)
    gate_match = re.search(r'"gate"\s*:\s*"([^"]+)"', command)
    result_match = re.search(r'"result"\s*:\s*"([^"]+)"', command)

    parts = []
    if stage_match and status_match:
        parts.append(f"Pipeline stage '{stage_match.group(1)}' → {status_match.group(1)}")
    if gate_match and result_match:
        parts.append(f"Pipeline gate '{gate_match.group(1)}': {result_match.group(1)}")

    if parts:
        output = {
            "hookSpecificOutput": {
                "hookEventName": "PostToolUse",
                "additionalContext": ". ".join(parts)
            }
        }
        print(json.dumps(output))


if __name__ == "__main__":
    main()
