{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume",
        "hooks": [
          {
            "type": "command",
            "command": "python3 \"${PROJECT_ROOT}/.codex/hooks/session-start.py\"",
            "statusMessage": "Loading pipeline context"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "python3 \"${PROJECT_ROOT}/.codex/hooks/pre-tool-use.py\"",
            "statusMessage": "Pipeline safety check"
          }
        ]
      }
    ],
    "PermissionRequest": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "python3 \"${PROJECT_ROOT}/.codex/hooks/permission-request.py\"",
            "statusMessage": "Pipeline permission check"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "python3 \"${PROJECT_ROOT}/.codex/hooks/post-tool-use.py\"",
            "statusMessage": "Tracking pipeline progress"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "python3 \"${PROJECT_ROOT}/.codex/hooks/stop.py\"",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
