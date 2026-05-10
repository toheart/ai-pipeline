#!/usr/bin/env python3
"""
Claude Code PreToolUse Hook 脚本

拦截危险 Bash 命令。
输出 permissionDecision: deny/ask 或静默通过。
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
    if not command:
        return

    # force push 拦截
    if re.search(r"git\s+push\s+.*(-f|--force)", command):
        output = {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": "Force push blocked by pipeline safety policy."
            }
        }
        print(json.dumps(output))
        return

    # 硬重置需要确认
    if re.search(r"git\s+reset\s+--hard", command):
        output = {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "ask",
                "permissionDecisionReason": "git reset --hard will discard uncommitted changes."
            }
        }
        print(json.dumps(output))
        return

    # 生产环境操作需要确认
    if re.search(r"kubectl\s+apply.*prod|docker\s+push", command):
        output = {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "ask",
                "permissionDecisionReason": "Production environment operation detected."
            }
        }
        print(json.dumps(output))
        return


if __name__ == "__main__":
    main()
