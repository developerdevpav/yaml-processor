---
name: yaml-processor-process-management
description: Use this skill when an LLM needs to create, edit, search, validate, import, export, or reason about yaml-processor process configurations through the HTTP MCP server, GraphQL-equivalent tools, YAML schemas, JsonLogic rules, and event validation.
---

# YAML Processor Process Management

Use this skill to control process configuration through the LLM-facing MCP HTTP server.

## Core Workflow

1. Discover tools with MCP `tools/list`.
2. Read or create a `ProcessConfig`.
3. Build the process tree in this order: `Process -> Subprocess -> Stage -> Configurator -> Result -> Reverse -> ReverseOutput`.
4. Use JsonLogic rules for event routing:
   - `subprocess.trigger.rule` decides whether the subprocess starts.
   - `configurator.filter-event-rule` filters events at the stage.
   - `reverse.output.rule` decides whether a response event is emitted.
5. Validate an incoming event with MCP tool `validateEvent` before saving or deploying a configuration.
6. Export YAML when a human-readable artifact is needed.

## MCP Endpoint

HTTP endpoint: `POST /mcp`

MCP methods:

- `initialize` - returns server metadata.
- `tools/list` - lists GraphQL-equivalent CRUD tools and custom node tools.
- `tools/call` - calls one tool with `params.name` and `params.arguments`.

Important custom tools:

- `createSubprocessNode`, `updateSubprocessNode`, `deleteSubprocessNode`
- `createStageNode`, `updateStageNode`, `deleteStageNode`
- `createConfiguratorNode`, `updateConfiguratorNode`, `deleteConfiguratorNode`
- `createResultNode`, `updateResultNode`, `deleteResultNode`
- `createReverseNode`, `updateReverseNode`, `deleteReverseNode`
- `createReverseOutputNode`, `updateReverseOutputNode`, `deleteReverseOutputNode`
- `reorderSubprocessStages`, `reorderReverseOutputs`
- `validateEvent`
- `searchProcesses`

## Configuration Model

- `process` is the root business process. `context-code` limits it to a business context, `disabled` disables the process, `node_name` and `node_comment` are operator-facing labels.
- `subprocess` groups stages and has `trigger.rule`, a JsonLogic rule evaluated against the incoming event.
- `stage` defines one executor step. `executor` is the service or handler name. `log.journal-service-name` configures integration journal logging.
- `configurator` defines filtering and response rules for a stage. `filter-event-rule` is JsonLogic. `interrupted` and `multiple` control process behavior. `audit` describes audit emission.
- `result.input-scenarios` lists incoming `b3event.body.service.scenario` values or glob patterns. `*` matches any sequence, `?` matches one character.
- `reverse.status` is the B3 status branch for responses.
- `reverse.output` describes response events. `phase` is the output phase, `rule` is JsonLogic, `body` describes the response event body, `log` configures event log output.
- `reverse.output.parent.include` enables parent formation for that response event.
- `reverse.output.parent.mode` controls where parent data comes from: `SURFACE` uses parent data from the incoming event; `DEEP` uses parent data from the incoming event's `parentProcess`.

## Minimal YAML Example

```yaml
process:
  id: process_credit
  context-code: PSPLUS
  node_name: Credit process
  subprocess:
    - id: subprocess_credit_start
      trigger:
        rule: |-
          {"==":[{"var":"b3event.type"},"CREDIT_REQUEST"]}
      stages:
        - id: stage_credit_check
          executor: credit.check
          configurator:
            filter-event-rule: |-
              {"==":[{"var":"b3event.body.service.scenario"},"credit.request.created"]}
            result:
              - input-scenarios:
                  - credit.request.*
                reverse:
                  - status: INITIATED
                    output:
                      - phase: START
                        name: credit-started
                        rule: |-
                          {"==":[{"var":"b3event.body.service.status"},"INITIATED"]}
                        parent:
                          include: true
                          mode: SURFACE
                        body:
                          type: SERVICE
                          service:
                            scenario: credit.request.accepted
                            type: CREDIT
                        log:
                          journal-service-name: credit-journal
```

JsonLogic values are stored as strings. In YAML, prefer literal blocks (`|-`) containing JSON.

## Create A Process Through MCP

Call `createProcessConfig` with nested input when creating a whole graph at once:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "createProcessConfig",
    "arguments": {
      "input": {
        "process": {
          "nodeName": "Credit process",
          "contextCode": { "code": "PSPLUS" },
          "subprocess": [
            {
              "nodeName": "Credit start",
              "trigger": { "rule": "{\"==\":[{\"var\":\"b3event.type\"},\"CREDIT_REQUEST\"]}" },
              "stages": [
                {
                  "executor": "credit.check",
                  "configurator": {
                    "filterEventRule": "{\"==\":[{\"var\":\"b3event.body.service.scenario\"},\"credit.request.created\"]}"
                  }
                }
              ]
            }
          ]
        }
      }
    }
  }
}
```

For controlled incremental editing, create a minimal root and then call node tools in order:

1. `createProcessConfig`
2. `createSubprocessNode(processId, input)`
3. `createStageNode(subprocessId, input)`
4. `createConfiguratorNode(stageId, input)`
5. `createResultNode(configuratorId, input)`
6. `createReverseNode(resultId, input)`
7. `createReverseOutputNode(reverseId, input)`

Use `update...Node` tools for edits and keep IDs stable.

## Get Processes Through MCP

Use `searchProcesses` when the user asks to show all processes or asks for a process by approximate name.

Return all processes:

```json
{
  "jsonrpc": "2.0",
  "id": 10,
  "method": "tools/call",
  "params": {
    "name": "searchProcesses",
    "arguments": {}
  }
}
```

Search by approximate name, description, id, processConfigId, or context code:

```json
{
  "jsonrpc": "2.0",
  "id": 11,
  "method": "tools/call",
  "params": {
    "name": "searchProcesses",
    "arguments": {
      "query": "ФЖН"
    }
  }
}
```

Example: if processes are named `ФЖН Цифровой` and `ФЖН Многопродуктовый`, query `ФЖН` must return both. If the user gives an exact UUID, pass it as `query`; if the user gives a rough human name, pass the meaningful fragment.

`searchProcesses` returns compact process summaries:

- `id` - process id.
- `processConfigId` - root config id to use with `processConfig` or `validateEvent`.
- `nodeName` - process display name.
- `nodeComment` - process description/comment.
- `contextCode` - context dictionary code.
- `disabled` - whether the process is disabled.
- `subprocessCount` - number of subprocesses.

When the full graph is needed after search, call `processConfig` with the returned `processConfigId`.

## Answer Questions About Sent Events In A Stage

Use this workflow when the user asks something like:

`Какие события отправляются в стадии Структурирование сделки ФЖН Цифровой?`

Interpret the request as:

- process query: `ФЖН Цифровой`
- stage query: `Структурирование сделки`
- target: outgoing events configured in `reverse.output` under this stage.

Steps:

1. Call `searchProcesses` with the process fragment:

```json
{
  "jsonrpc": "2.0",
  "id": 20,
  "method": "tools/call",
  "params": {
    "name": "searchProcesses",
    "arguments": {
      "query": "ФЖН Цифровой"
    }
  }
}
```

2. If several processes match, choose the closest by `nodeName`; if ambiguous, show candidates and ask for clarification. If one process matches, call `processConfig` with `processConfigId`:

```json
{
  "jsonrpc": "2.0",
  "id": 21,
  "method": "tools/call",
  "params": {
    "name": "processConfig",
    "arguments": {
      "id": "<processConfigId>"
    }
  }
}
```

3. Search inside `process.subprocess[].stages[]` by approximate match against:

- `stage.nodeName`
- `stage.nodeComment`
- `stage.executor`

Use case-insensitive contains matching. For `Структурирование сделки`, a stage named `Структурирование сделки`, `ФЖН. Структурирование`, or executor `deal.structuring` may be relevant; prefer `nodeName` over executor when both match.

4. For every matched stage, read:

- `stage.configurator.filterEventRule`
- `stage.configurator.result[].inputScenarios`
- `stage.configurator.result[].reverse[].status.code`
- `stage.configurator.result[].reverse[].output[]`

Each outgoing event is one `reverse.output` item.

5. Present the result in a compact but explanatory format.

Recommended output format:

```markdown
В стадии `<stage nodeName>` процесса `<process nodeName>` настроены такие исходящие события:

1. `<output.name или body.service.scenario>`
   - Когда формируется:
     - входящий сценарий: `<result.inputScenarios>`
     - B3 status ветка: `<reverse.status.code>`
     - phase: `<output.phase.code>`
     - stage filter-event-rule: `<human-readable JsonLogic summary>`
     - output rule: `<human-readable JsonLogic summary>`
   - Как выглядит событие:
     - body.type: `<output.body.type>`
     - body.service.scenario: `<output.body.service.scenario>`
     - body.service.type: `<output.body.service.type>`
     - body.service.status: `<output.body.service.status.code>`
     - body.event-object.type: `<output.body.eventObject.type>`
     - SLA: `<status / duration_value / duration_unit, if present>`
   - Parent:
     - include: `<true/false/не задан>`
     - mode: `<SURFACE/DEEP/не задан>`
   - Логирование:
     - journal-service-name: `<output.log.journal-service-name>`
     - message: `<output.log.message>`
```

If a value is absent, write `не задано` instead of omitting it when the absence is meaningful. If there are no `reverse.output` items in the stage, say that the stage does not send configured outgoing events.

## Human-Readable JsonLogic Summaries

When explaining rules, do not dump raw JSON only. Give a human-readable summary and include raw JsonLogic only if it is short or the user asks for exact rules.

Examples:

- `{"==":[{"var":"b3event.body.service.scenario"},"x"]}` -> `сценарий входящего события равен x`
- `{"==":[{"var":"b3event.body.service.status"},"INITIATED"]}` -> `статус входящего service равен INITIATED`
- `{"and":[A,B]}` -> `выполняются оба условия: ...`
- blank rule -> `условие не задано, правило не ограничивает отправку`

For event-search answers, explain the decision chain:

1. Subprocess trigger decides whether the subprocess starts.
2. Stage `filter-event-rule` decides whether this stage accepts the incoming event.
3. `result.input-scenarios` decides which scenario branch is used.
4. `reverse.status` selects the status branch.
5. `reverse.output.rule` decides whether a concrete outgoing event is sent.

## Brief Business Explanation Style

Use this style when the user asks:

- `Что делает процесс ...?`
- `Что делает подпроцесс ...?`
- `Какие отправляются события по процессу ...?`
- `Какие события отправляются в подпроцессе/стадии ...?`

Goal: explain behavior in business terms, not as raw YAML. Mention exact fields only where they clarify the event contract.

Process-level answer structure:

```markdown
Процесс `<process nodeName>` обрабатывает события в контексте `<contextCode>`.

Кратко:
<1-3 sentences: what incoming events it accepts and what outgoing events it can send.>

Подпроцессы:
- `<subprocess nodeName/id>`: запускается, когда `<trigger summary>`.
  - Стадия `<stage nodeName/executor>`: принимает события, когда `<filter summary>`.
  - Отправляет:
    <short outgoing event list>
```

Outgoing event summary format:

```markdown
Если входящее событие имеет сценарий (`event.body.service.scenario`) `<input-scenarios>` и статус (`event.body.service.status`) `<status from output rule or reverse.status>`:

Мы отправляем `<human output name>` (`<phase>`):

Тип: `<human phase/type description>`

`event.body.service.type`: `<output.body.service.type>`
`event.body.service.scenario`: `<output.body.service.scenario>`
`event.body.service.status`: `<output.body.service.status.code>`
`event.body.type`: `<output.body.type>`

В интеграционный журнал записываем под `service.name`: `<output.log.journal-service-name>`
```

If `output.body.service.status` is absent but the status is present in `reverse.status`, say:

`Статус ветки reverse: <reverse.status>; в самом отправляемом body status не задан.`

If `output.name` is present, use it as the human output name. If absent, use `output.body.service.scenario`; if both are absent, use `исходящее событие без имени`.

Map common phases to human words:

- `START` -> `стартовое событие`
- `BUSINESS_COMPLETE` -> `событие бизнес-завершения`
- `ACTIVITY_COMPLETE` -> `событие завершения активности`
- `COMPLETE_FAILURE` -> `событие ошибки/негативного завершения`
- `CHANGE_BUSINESS_STAGE` -> `событие смены бизнес-стадии`
- `CHECK_IN` -> `событие check-in`
- otherwise use `событие фазы <phase>`

When deriving the status condition:

- Prefer a simple equality in `reverse.output.rule`, for example `event.body.service.status == INITIATED`.
- If the output rule is blank, say `дополнительное правило отправки не задано`.
- If the status only comes from `reverse.status`, phrase it as `в ветке reverse со статусом <status>`.

Example source:

```yaml
- id: subprocess_credit_start
  trigger:
    rule: |-
      {"==":[{"var":"b3event.type"},"CREDIT_REQUEST"]}
  stages:
    - id: stage_credit_check
      executor: credit.check
      configurator:
        filter-event-rule: |-
          {"==":[{"var":"b3event.body.service.scenario"},"credit.request.created"]}
        result:
          - input-scenarios:
              - credit.request.*
            reverse:
              - status: INITIATED
                output:
                  - phase: START
                    name: credit-started
                    rule: |-
                      {"==":[{"var":"b3event.body.service.status"},"INITIATED"]}
                    parent:
                      include: true
                      mode: SURFACE
                    body:
                      type: SERVICE
                      service:
                        scenario: credit.request.accepted
                        type: CREDIT
                        status: STARTED
                    log:
                      journal-service-name: credit-journal
```

Example answer:

```markdown
Если входящее событие имеет сценарий (`event.body.service.scenario`) `credit.request.*` и статус (`event.body.service.status`) `INITIATED`:

Мы отправляем `credit-started` (`START`):

Тип: стартовое событие

`event.body.service.type`: `CREDIT`
`event.body.service.scenario`: `credit.request.accepted`
`event.body.service.status`: `STARTED`
`event.body.type`: `SERVICE`

Parent будет сформирован из входящего события (`SURFACE`).

В интеграционный журнал записываем под `service.name`: `credit-journal`.
```

Keep answers short by default. If there are many outputs, group by `input-scenarios`, then by `reverse.status`, then list outgoing events under each group.

## Reverse Output Parent Example

```json
{
  "phase": { "code": "START" },
  "name": "emit-response",
  "parent": {
    "include": true,
    "mode": "DEEP"
  },
  "body": {
    "type": "SERVICE",
    "service": {
      "scenario": "credit.response.created",
      "type": "CREDIT"
    }
  }
}
```

Use `SURFACE` when the response must copy parent data directly from the incoming event. Use `DEEP` when the response must use the incoming event's `parentProcess` as the source.

## Search And Validate Events

Use `validateEvent` to find which saved process configuration accepts an event and which reverse outputs are eligible.

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "validateEvent",
    "arguments": {
      "processConfigId": "optional-uuid",
      "includeNonMatches": false,
      "event": {
        "b3event": {
          "type": "CREDIT_REQUEST",
          "body": {
            "service": {
              "scenario": "credit.request.created",
              "status": "INITIATED"
            }
          }
        }
      }
    }
  }
}
```

The response contains:

- `scenario` - extracted from `b3event.body.service.scenario`.
- `matched` - true when at least one process path matches.
- `processConfigs[].process.subprocess[].trigger` - JsonLogic result for subprocess trigger.
- `stages[].filterEventRule` - JsonLogic result for stage filter.
- `results[].scenarioMatched` - whether the event scenario matched `input-scenarios`.
- `reverse[].outputs[].rule` - JsonLogic result for reverse output rule.
- `reverse[].outputs[].parent` - parent include/mode selected for the response.

Set `includeNonMatches: true` when debugging why an event did not match. The tool will include failed branches and errors from invalid JsonLogic.

## JsonLogic Examples

Match event type:

```json
{ "==": [ { "var": "b3event.type" }, "CREDIT_REQUEST" ] }
```

Match scenario and status:

```json
{
  "and": [
    { "==": [ { "var": "b3event.body.service.scenario" }, "credit.request.created" ] },
    { "==": [ { "var": "b3event.body.service.status" }, "INITIATED" ] }
  ]
}
```

Check nested parent data:

```json
{ "!=": [ { "var": "b3event.parentProcess.id" }, null ] }
```

## Practical Rules For LLMs

- Start with a concrete example event, then create `trigger.rule`, `filter-event-rule`, `input-scenarios`, and output `rule` around that event.
- After each structural change, call `validateEvent` with the intended event.
- For broad scenario groups, use `input-scenarios` glob patterns such as `credit.request.*`.
- Keep response `body.service.scenario` explicit; it is the outgoing scenario.
- Use `parent.include: false` or omit `parent` when the response must not carry parent data.
