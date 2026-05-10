# Pipeline Server API Reference

Server runs at `http://127.0.0.1:19090`. All POST requests use `Content-Type: application/json`.

## Table of Contents

- [Health Check](#health-check)
- [Pipeline Instance Management](#pipeline-instance-management)
- [Stage Status](#stage-status)
- [Gate Decision](#gate-decision)
- [Templates and Manifests](#templates-and-manifests)
- [Audit Log](#audit-log)

## Health Check

```
GET /healthz
```

Returns server status and active pipeline list.

## Pipeline Instance Management

### List All Instances

```
GET /api/v1/pipelines
```

Returns summary of all known pipeline instances (id, template, change_name, current_stage, stage statistics).

### Create / Resume Instance

```
POST /api/v1/pipelines
{
  "template": "go-backend-only",
  "change_name": "add-user-api"
}
```

- `template` (required): Template name, corresponding to YAML filename (without `.yaml`) under `templates/` or `.cursor/pipelines/`
- `change_name` (optional): Change name, used to generate pipeline_id = `{template}--{change_name}`
- `id` (optional): Directly specify pipeline_id, takes priority over auto-generation

**Response**:

```json
{
  "status": "ok",
  "id": "go-backend-only--add-user-api",
  "template": "go-backend-only",
  "change_name": "add-user-api",
  "resumed": false
}
```

`resumed: true` means the instance already exists, preserving original state (for interruption recovery).

### Reset Instance

```
POST /api/v1/pipelines/reset
{ "id": "<pipeline-id>" }
```

Resets all stage statuses to pending for the specified instance.

### View Instance State

```
GET /api/v1/pipeline/state?pipeline=<pipeline-id>
```

Returns full PipelineState (stages, active_agents, completed_agents, gates).

## Stage Status

### Advance Stage

```
POST /api/v1/pipeline/stage
{
  "pipeline": "<pipeline-id>",
  "stage": "<stage-name>",
  "status": "active|completed|failed|skipped"
}
```

**Typical call sequence**:

```bash
# Stage start
curl -s -X POST http://127.0.0.1:19090/api/v1/pipeline/stage \
  -H "Content-Type: application/json" \
  -d '{"pipeline":"my-pipeline","stage":"implement","status":"active"}'

# Stage complete
curl -s -X POST http://127.0.0.1:19090/api/v1/pipeline/stage \
  -H "Content-Type: application/json" \
  -d '{"pipeline":"my-pipeline","stage":"implement","status":"completed"}'
```

## Gate Decision

```
POST /api/v1/pipeline/gate
{
  "pipeline": "<pipeline-id>",
  "gate": "<gate-name>",
  "result": "passed|failed",
  "comment": "optional note"
}
```

## Update Change Name

```
POST /api/v1/pipeline/change
{
  "pipeline": "<pipeline-id>",
  "name": "new-change-name"
}
```

## Templates and Manifests

### List Templates

```
GET /api/v1/pipeline/templates
```

Returns all available templates (name, description, file).

### List Manifests

```
GET /api/v1/manifests
```

Returns all compiled Manifest JSONs.

### Get Single Manifest

```
GET /api/v1/manifests/<name>
```

## Audit Log

```
GET /api/v1/pipeline/audit?limit=20&pipeline=<pipeline-id>
```

Returns recent audit event records.

## WebSocket Real-time Push

Connect to `ws://127.0.0.1:19090/ws` to receive real-time events:

- `pipeline_created` -- new instance created
- `pipeline_reset` -- instance reset
- `stage_updated` -- stage status change
- `gate_decided` -- gate decision result
- `change_updated` -- change name updated
