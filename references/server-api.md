# Pipeline Server API 参考

Server 运行在 `http://127.0.0.1:19090`。所有 POST 请求使用 `Content-Type: application/json`。

## 健康检查

```
GET /healthz
```

返回服务状态和活跃流水线列表。

## 流水线实例管理

### 列出所有实例

```
GET /api/v1/pipelines
```

返回所有流水线实例的摘要（id、template、change_name、current_stage、阶段统计）。

### 创建/恢复实例

```
POST /api/v1/pipelines
{
  "template": "go-backend-only",
  "change_name": "add-user-api"
}
```

- `template`（必填）：模板名称，对应 `templates/` 下的 YAML 文件名（不含 `.yaml`）
- `change_name`（可选）：变更名称，用于生成 pipeline_id = `{template}--{change_name}`
- `id`（可选）：直接指定 pipeline_id，优先于自动生成

**响应**：

```json
{
  "status": "ok",
  "id": "go-backend-only--add-user-api",
  "template": "go-backend-only",
  "change_name": "add-user-api",
  "resumed": false
}
```

`resumed: true` 表示实例已存在，保留原始状态（用于中断恢复）。

### 重置实例

```
POST /api/v1/pipelines/reset
{ "id": "<pipeline-id>" }
```

将指定实例的所有阶段状态重置为 pending。

### 查看实例状态

```
GET /api/v1/pipeline/state?pipeline=<pipeline-id>
```

返回完整的 PipelineState（stages、active_agents、completed_agents、gates）。

## 阶段状态上报

```
POST /api/v1/pipeline/stage
{
  "pipeline": "<pipeline-id>",
  "stage": "<stage-name>",
  "status": "active|completed|failed|skipped"
}
```

**典型调用序列**：

```bash
# 阶段开始
curl -s -X POST http://127.0.0.1:19090/api/v1/pipeline/stage \
  -H "Content-Type: application/json" \
  -d '{"pipeline":"my-pipeline","stage":"implement","status":"active"}'

# 阶段完成
curl -s -X POST http://127.0.0.1:19090/api/v1/pipeline/stage \
  -H "Content-Type: application/json" \
  -d '{"pipeline":"my-pipeline","stage":"implement","status":"completed"}'
```

## Gate 决策

```
POST /api/v1/pipeline/gate
{
  "pipeline": "<pipeline-id>",
  "gate": "<gate-name>",
  "result": "passed|failed",
  "comment": "可选备注"
}
```

## 更新变更名称

```
POST /api/v1/pipeline/change
{
  "pipeline": "<pipeline-id>",
  "name": "new-change-name"
}
```

## 模板与 Manifest

### 列出模板

```
GET /api/v1/pipeline/templates
```

### 列出 Manifest

```
GET /api/v1/manifests
```

### 获取单个 Manifest

```
GET /api/v1/manifests/<name>
```

## 审计日志

```
GET /api/v1/pipeline/audit?limit=20&pipeline=<pipeline-id>
```

## WebSocket 实时推送

连接 `ws://127.0.0.1:19090/ws` 接收实时事件：

- `pipeline_created` — 新实例创建
- `pipeline_reset` — 实例重置
- `stage_updated` — 阶段状态变更
- `gate_decided` — Gate 决策结果
- `change_updated` — 变更名称更新
