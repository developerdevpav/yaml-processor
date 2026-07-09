---
name: yaml-processor-process-management
description: Используйте этот скил, когда LLM нужно создавать, редактировать, искать, валидировать, импортировать, экспортировать или анализировать конфигурации процессов yaml-processor через HTTP MCP сервер, GraphQL-эквивалентные инструменты, YAML-схемы, правила JsonLogic и валидацию событий.
---

# Управление Процессами YAML Processor

Используйте этот скил для управления конфигурацией процессов через MCP HTTP сервер, предназначенный для работы с LLM.

## Основной Рабочий Процесс

1. Получите список инструментов через MCP `tools/list`.
2. Прочитайте или создайте `ProcessConfig`.
3. Собирайте дерево процесса в таком порядке: `Process -> Subprocess -> Stage -> Configurator -> Result -> Reverse -> ReverseOutput`.
4. Используйте правила JsonLogic для маршрутизации событий:
   - `subprocess.trigger.rule` определяет, должен ли запуститься подпроцесс.
   - `configurator.filter-event-rule` фильтрует события на стадии.
   - `reverse.output.rule` определяет, нужно ли отправить ответное событие.
5. Перед сохранением или внедрением конфигурации провалидируйте входящее событие MCP-инструментом `validateEvent`.
6. Экспортируйте YAML, когда нужен человекочитаемый артефакт.

## MCP-Точка Входа

HTTP endpoint: `POST /mcp`

MCP-методы:

- `initialize` - возвращает метаданные сервера.
- `tools/list` - выводит GraphQL-эквивалентные CRUD-инструменты и кастомные node-инструменты.
- `tools/call` - вызывает один инструмент по `params.name` и `params.arguments`.

Важные кастомные инструменты:

- `createSubprocessNode`, `updateSubprocessNode`, `deleteSubprocessNode`
- `createStageNode`, `updateStageNode`, `deleteStageNode`
- `createConfiguratorNode`, `updateConfiguratorNode`, `deleteConfiguratorNode`
- `createResultNode`, `updateResultNode`, `deleteResultNode`
- `createReverseNode`, `updateReverseNode`, `deleteReverseNode`
- `createReverseOutputNode`, `updateReverseOutputNode`, `deleteReverseOutputNode`
- `reorderSubprocessStages`, `reorderReverseOutputs`
- `validateEvent`
- `searchProcesses`

## Модель Конфигурации

- `process` - корневой бизнес-процесс. `context-code` ограничивает его бизнес-контекстом, `disabled` отключает процесс, `node_name` и `node_comment` являются названиями и комментариями для оператора.
- `subprocess` группирует стадии и содержит `trigger.rule`, правило JsonLogic, которое вычисляется на входящем событии.
- `stage` описывает один шаг исполнителя. `executor` - имя сервиса или обработчика. `log.journal-service-name` настраивает запись в интеграционный журнал.
- `configurator` задает фильтрацию и правила ответов для стадии. `filter-event-rule` - JsonLogic. `interrupted` и `multiple` управляют поведением процесса. `audit` описывает отправку аудита.
- `result.input-scenarios` перечисляет значения входящего `b3event.body.service.scenario`, regexp-паттерны вроде `^NEW:.*` или glob-паттерны. `*` в glob соответствует любой последовательности, `?` соответствует одному символу.
- `reverse.status` - B3 status ветка для ответов.
- `reverse.output` описывает ответные события. `phase` - фаза исходящего события, `rule` - JsonLogic, `body` описывает тело ответного события, `log` настраивает логирование события.
- `reverse.output.parent.include` включает формирование родительского процесса для этого ответного события.
- `reverse.output.parent.mode` управляет источником родительских данных: `SURFACE` берет родительские данные из входящего события; `DEEP` берет родительские данные из `parentProcess` входящего события.

## Минимальный YAML-Пример

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

Значения JsonLogic хранятся как строки. В YAML предпочитайте literal block (`|-`) с JSON внутри.

## Создание Процесса Через MCP

При создании всего графа сразу вызывайте `createProcessConfig` с вложенным input:

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

Для контролируемого поэтапного редактирования создайте минимальный root, а затем вызывайте node-инструменты по порядку:

1. `createProcessConfig`
2. `createSubprocessNode(processId, input)`
3. `createStageNode(subprocessId, input)`
4. `createConfiguratorNode(stageId, input)`
5. `createResultNode(configuratorId, input)`
6. `createReverseNode(resultId, input)`
7. `createReverseOutputNode(reverseId, input)`

Для изменений используйте инструменты `update...Node` и сохраняйте ID стабильными.

## Получение Процессов Через MCP

Используйте `searchProcesses`, когда пользователь просит показать все процессы или найти процесс по примерному названию.

Вернуть все процессы:

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

Поиск по примерному названию, описанию, id, processConfigId или context code:

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

Пример: если процессы называются `ФЖН Цифровой` и `ФЖН Многопродуктовый`, запрос `ФЖН` должен вернуть оба. Если пользователь дает точный UUID, передавайте его как `query`; если пользователь дает примерное человеческое название, передавайте значимый фрагмент.

`searchProcesses` возвращает компактные summary процессов:

- `id` - id процесса.
- `processConfigId` - id корневой конфигурации для использования с `processConfig` или `validateEvent`.
- `nodeName` - отображаемое имя процесса.
- `nodeComment` - описание/комментарий процесса.
- `contextCode` - код справочника контекстов.
- `disabled` - отключен ли процесс.
- `subprocessCount` - количество подпроцессов.

Когда после поиска нужен полный граф, вызовите `processConfig` с возвращенным `processConfigId`.

## Ответы На Вопросы Об Отправляемых Событиях В Стадии

Используйте этот workflow, когда пользователь спрашивает что-то вроде:

`Какие события отправляются в стадии Структурирование сделки ФЖН Цифровой?`

Интерпретируйте запрос так:

- запрос процесса: `ФЖН Цифровой`
- запрос стадии: `Структурирование сделки`
- цель: исходящие события, настроенные в `reverse.output` внутри этой стадии.

Шаги:

1. Вызовите `searchProcesses` с фрагментом процесса:

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

2. Если найдено несколько процессов, выберите ближайший по `nodeName`; если неоднозначно, покажите кандидатов и попросите уточнение. Если найден один процесс, вызовите `processConfig` с `processConfigId`:

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

3. Найдите стадию внутри `process.subprocess[].stages[]` примерным совпадением по:

- `stage.nodeName`
- `stage.nodeComment`
- `stage.executor`

Используйте регистронезависимое contains-сопоставление. Для `Структурирование сделки` могут быть релевантны стадия с названием `Структурирование сделки`, `ФЖН. Структурирование` или executor `deal.structuring`; при совпадении нескольких полей предпочитайте `nodeName`, а не executor.

4. Для каждой найденной стадии прочитайте:

- `stage.configurator.filterEventRule`
- `stage.configurator.result[].inputScenarios`
- `stage.configurator.result[].reverse[].status.code`
- `stage.configurator.result[].reverse[].output[]`

Каждое исходящее событие - это один элемент `reverse.output`.

5. Представьте результат компактно, но с пояснениями.

Рекомендуемый формат ответа:

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
     - SLA: `<status / duration_value / duration_unit, если есть>`
   - Parent:
     - include: `<true/false/не задан>`
     - mode: `<SURFACE/DEEP/не задан>`
   - Логирование:
     - journal-service-name: `<output.log.journal-service-name>`
     - message: `<output.log.message>`
```

Если значение отсутствует, пишите `не задано` вместо того, чтобы пропускать его, когда отсутствие важно. Если в стадии нет элементов `reverse.output`, скажите, что стадия не отправляет настроенных исходящих событий.

## Человекочитаемые Описания JsonLogic

Когда объясняете правила, не показывайте только сырой JSON. Дайте человекочитаемое описание и добавляйте исходный JsonLogic только если он короткий или пользователь просит точные правила.

Примеры:

- `{"==":[{"var":"b3event.body.service.scenario"},"x"]}` -> `сценарий входящего события равен x`
- `{"==":[{"var":"b3event.body.service.status"},"INITIATED"]}` -> `статус входящего service равен INITIATED`
- `{"and":[A,B]}` -> `выполняются оба условия: ...`
- пустое правило -> `условие не задано, правило не ограничивает отправку`

В ответах про поиск событий объясняйте цепочку принятия решения:

1. Subprocess trigger определяет, запускается ли подпроцесс.
2. Stage `filter-event-rule` определяет, принимает ли эта стадия входящее событие.
3. `result.input-scenarios` определяет, какая сценарная ветка используется.
4. `reverse.status` выбирает status-ветку.
5. `reverse.output.rule` определяет, отправляется ли конкретное исходящее событие.

## Краткий Стиль Бизнес-Описания

Используйте этот стиль, когда пользователь спрашивает:

- `Что делает процесс ...?`
- `Что делает подпроцесс ...?`
- `Какие отправляются события по процессу ...?`
- `Какие события отправляются в подпроцессе/стадии ...?`

Цель: объяснить поведение в бизнес-терминах, а не как сырой YAML. Упоминайте точные поля только там, где они поясняют контракт события.

Структура ответа на уровне процесса:

```markdown
Процесс `<process nodeName>` обрабатывает события в контексте `<contextCode>`.

Кратко:
<1-3 предложения: какие входящие события он принимает и какие исходящие события может отправлять.>

Подпроцессы:
- `<subprocess nodeName/id>`: запускается, когда `<trigger summary>`.
  - Стадия `<stage nodeName/executor>`: принимает события, когда `<filter summary>`.
  - Отправляет:
    <short outgoing event list>
```

Формат summary исходящего события:

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

Если `output.body.service.status` отсутствует, но статус есть в `reverse.status`, скажите:

`Статус ветки reverse: <reverse.status>; в самом отправляемом body status не задан.`

Если `output.name` задан, используйте его как человеческое имя исходящего события. Если он отсутствует, используйте `output.body.service.scenario`; если оба отсутствуют, используйте `исходящее событие без имени`.

Сопоставляйте распространенные фазы с человеческими формулировками:

- `START` -> `стартовое событие`
- `BUSINESS_COMPLETE` -> `событие бизнес-завершения`
- `ACTIVITY_COMPLETE` -> `событие завершения активности`
- `COMPLETE_FAILURE` -> `событие ошибки/негативного завершения`
- `CHANGE_BUSINESS_STAGE` -> `событие смены бизнес-стадии`
- `CHECK_IN` -> `событие check-in`
- иначе используйте `событие фазы <phase>`

При выводе условия по статусу:

- Предпочитайте простое равенство в `reverse.output.rule`, например `event.body.service.status == INITIATED`.
- Если output rule пустой, скажите `дополнительное правило отправки не задано`.
- Если статус берется только из `reverse.status`, формулируйте это как `в ветке reverse со статусом <status>`.

Пример источника:

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

Пример ответа:

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

По умолчанию отвечайте кратко. Если исходящих событий много, группируйте их по `input-scenarios`, затем по `reverse.status`, затем перечисляйте исходящие события внутри каждой группы.

## Пример Reverse Output Parent

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

Используйте `SURFACE`, когда ответ должен копировать родительские данные напрямую из входящего события. Используйте `DEEP`, когда ответ должен использовать `parentProcess` входящего события как источник.

## Поиск И Валидация Событий

Используйте `validateEvent`, чтобы определить, какая сохраненная конфигурация процесса принимает событие и какие reverse outputs подходят для отправки.

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

Ответ содержит:

- `scenario` - извлечен из `b3event.body.service.scenario`.
- `matched` - true, когда совпал хотя бы один путь процесса.
- `processConfigs[].process.subprocess[].trigger` - результат JsonLogic для subprocess trigger.
- `stages[].filterEventRule` - результат JsonLogic для stage filter.
- `results[].scenarioMatched` - совпал ли сценарий события с `input-scenarios`.
- `reverse[].outputs[].rule` - результат JsonLogic для reverse output rule.
- `reverse[].outputs[].parent` - выбранные parent include/mode для ответа.

Устанавливайте `includeNonMatches: true`, когда нужно понять, почему событие не совпало. Инструмент включит неуспешные ветки и ошибки невалидного JsonLogic.

## Примеры JsonLogic

Совпадение по типу события:

```json
{ "==": [ { "var": "b3event.type" }, "CREDIT_REQUEST" ] }
```

Совпадение по сценарию и статусу:

```json
{
  "and": [
    { "==": [ { "var": "b3event.body.service.scenario" }, "credit.request.created" ] },
    { "==": [ { "var": "b3event.body.service.status" }, "INITIATED" ] }
  ]
}
```

Проверка вложенных родительских данных:

```json
{ "!=": [ { "var": "b3event.parentProcess.id" }, null ] }
```

## Практические Правила Для LLM

- Начинайте с конкретного примера события, затем создавайте вокруг него `trigger.rule`, `filter-event-rule`, `input-scenarios` и output `rule`.
- После каждого структурного изменения вызывайте `validateEvent` с целевым событием.
- Для широких групп сценариев используйте regexp-паттерны `input-scenarios`, например `^NEW:.*`, или glob-паттерны, например `credit.request.*`.
- Явно задавайте `body.service.scenario` в ответе; это исходящий сценарий.
- Используйте `parent.include: false` или не задавайте `parent`, когда ответ не должен нести родительские данные.
