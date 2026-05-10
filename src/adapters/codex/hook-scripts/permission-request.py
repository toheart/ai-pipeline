#!/usr/bin/env python3
"""
Codex PermissionRequest Hook 脚本

Codex 特有事件：在 Codex 即将请求用户审批时触发。
可以提前 allow 或 deny，避免弹出审批提示。

这是 Codex 独有的能力，Claude Code 虽然也支持但格式略有不同。
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

    # 销毁性系统命令直接拒绝
    if re.search(r"rm\s+-rf\s+\/|mkfs|dd\s+if=", command):
        output = {
            "hookSpecificOutput": {
                "hookEventName": "PermissionRequest",
                "decision": {
                    "behavior": "deny",
                    "message": "Destructive system command blocked by pipeline policy."
                }
            }
        }
        print(json.dumps(output))
        return

    # Pipeline Server 相关命令自动放行
    if "127.0.0.1:19090" in command:
        output = {
            "hookSpecificOutput": {
                "hookEventName": "PermissionRequest",
                "decision": {
                    "behavior": "allow"
                }
            }
        }
        print(json.dumps(output))
        return


if __name__ == "__main__":
    main()
