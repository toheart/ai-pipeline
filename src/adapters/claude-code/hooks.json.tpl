{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume",
        "hooks": [
          {
            "type": "command",
            "command": "python3 \"${PROJECT_ROOT}/.claude/hooks/session-start.py\"",
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
            "command": "python3 \"${PROJECT_ROOT}/.claude/hooks/pre-tool-use.py\"",
            "statusMessage": "Pipeline safety check"
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
            "command": "python3 \"${PROJECT_ROOT}/.claude/hooks/post-tool-use.py\"",
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
            "command": "python3 \"${PROJECT_ROOT}/.claude/hooks/stop.py\"",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
