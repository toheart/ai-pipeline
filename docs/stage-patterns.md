# Stage Dispatch Patterns

Dispatch patterns and considerations for the three types of Pipeline stages.

## Table of Contents

- [Agent Stage](#agent-stage)
- [Skill Stage](#skill-stage)
- [Gate Stage](#gate-stage)
- [Parallel Stage](#parallel-stage)
- [Conditionals and Loops (SDK Mode)](#conditionals-and-loops-sdk-mode)

## Agent Stage

Dispatch SubAgents via the Task tool. The Hook system auto-tracks start/stop events.

### Dispatch Template

```
Task tool call:
  description: "[pipeline:<pipeline-id>] <agent-name>: <brief task description>"
  prompt: |
    Before doing anything, read .cursor/agents/<agent-name>.md and strictly follow all instructions.

    ## Task
    <detailed task description>

    ## Context
    - Change: <change-name>
    - Relevant files: <file paths from previous stage output>

    ## Scope
    <scope, e.g. backend/ or frontend/>
```

### Key Points

- The `[pipeline:<id>]` tag **must** appear in the description -- Hooks use it to route events to the correct Pipeline instance
- The prompt **must** start with a read instruction for the Agent definition file (Task tool does NOT auto-load `.cursor/agents/*.md`)
- After SubAgent completes, proactively call API to mark stage completed (do not fully rely on Hooks -- they may mismatch when multiple pipelines run in parallel)

### Status Reporting

```bash
# Before launch (optional -- Hook also marks this, but recommended for consistency)
curl -s -X POST http://127.0.0.1:19090/api/v1/pipeline/stage \
  -H "Content-Type: application/json" \
  -d '{"pipeline":"<id>","stage":"<name>","status":"active"}'

# After SubAgent completes (required)
curl -s -X POST http://127.0.0.1:19090/api/v1/pipeline/stage \
  -H "Content-Type: application/json" \
  -d '{"pipeline":"<id>","stage":"<name>","status":"completed"}'
```

## Skill Stage

Skill stages are executed by the main Agent directly (e.g. `openspec-propose`, `openspec-archive`), without spawning a SubAgent.

### Dispatch Template

```
1. Report active status
2. Execute Skill workflow (load corresponding Skill, call APIs, etc.)
3. Report completed status
```

### Key Points

- Hooks **cannot detect** Skill invocations at all -- status reporting **must be done manually**
- Skills may depend on external services (e.g. OpenSpec's cocursor daemon)
- Skill input usually comes from previous stage output (e.g. explorer's conclusion)

### Status Reporting

```bash
# Before start (required)
curl -s -X POST http://127.0.0.1:19090/api/v1/pipeline/stage \
  -H "Content-Type: application/json" \
  -d '{"pipeline":"<id>","stage":"propose","status":"active"}'

# After completion (required)
curl -s -X POST http://127.0.0.1:19090/api/v1/pipeline/stage \
  -H "Content-Type: application/json" \
  -d '{"pipeline":"<id>","stage":"propose","status":"completed"}'
```

## Gate Stage

Gates are human checkpoints. The AI must pause and wait for user decision.

### Interaction Template

```markdown
## Gate: <description>

<previous stage conclusion summary>

**Options:**
1. Approve -- continue to next stage
2. Request changes (specify what to change and which stage to roll back to)
3. Abort pipeline
```

### Decision Handling

| User Choice | Action |
|-------------|--------|
| Approve | Call `POST /api/v1/pipeline/gate {"result":"passed"}`, continue to next stage |
| Changes | Call `POST /api/v1/pipeline/gate {"result":"failed"}`, roll back to specified stage |
| Abort | Save current state, exit pipeline |

### Key Points

- **Never auto-skip a Gate** -- must wait for explicit user confirmation
- Gate name comes from the Pipeline definition's `name` or `gate_description` field
- Different Gates can have different option descriptions (e.g. "Confirm design" vs "Confirm code quality")

## Parallel Stage

Defined via the `parallel` field in YAML templates, or via `parallel()` function in the SDK.

### Dispatch Template

```
In a single message, issue multiple Task tool calls:

Task 1:
  description: "[pipeline:<id>] backend-implementer: Implement backend features"
  prompt: "..."

Task 2:
  description: "[pipeline:<id>] frontend-implementer: Implement frontend features"
  prompt: "..."
```

### Key Points

- Issue all parallel Tasks in **the same message** -- Cursor will execute them concurrently
- Wait for **all** SubAgents to complete before marking the stage completed and moving on
- If one fails, keep the other's result and only re-run the failed one
- Parallel stages usually have different scopes (e.g. `backend/` vs `frontend/`) to avoid file conflicts

### Status Reporting

```bash
# Before parallel launch (mark active proactively)
curl -s -X POST http://127.0.0.1:19090/api/v1/pipeline/stage \
  -H "Content-Type: application/json" \
  -d '{"pipeline":"<id>","stage":"implement","status":"active"}'

# After all parallel SubAgents complete
curl -s -X POST http://127.0.0.1:19090/api/v1/pipeline/stage \
  -H "Content-Type: application/json" \
  -d '{"pipeline":"<id>","stage":"implement","status":"completed"}'
```

## Conditionals and Loops (SDK Mode)

TypeScript Pipelines use native `if/else` and `while/for` syntax.

### Conditionals

Read the `.ts` source file to understand branching logic. Choose the actual path based on the previous stage's output.

```typescript
// Example: choose path based on explorer conclusion
if (exploration.output.scope === "config-only") {
  stage("review", { agent: "reviewer" });
  return; // simplified flow
}
// normal full flow...
```

### Loops (Retry)

Typically used when code-review does not pass:

```typescript
let reviewPassed = false;
let attempts = 0;
while (!reviewPassed && attempts < 3) {
  stage("review", { agent: "code-reviewer" });
  const decision = gate("Confirm code quality");
  if (decision === "approve") {
    reviewPassed = true;
  } else {
    stage("fix", { agent: "implementer", task: "Fix review issues" });
    attempts++;
  }
}
```

The orchestrator must track loop count at runtime and inform the user when the limit is reached.
