package com.sber.yamlprocessor.yaml

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test

@DisplayName("Форматирование YAML")
class YamlFormattingServiceTest {
    private val formattingService = YamlFormattingService()

    @Test
    @DisplayName("Выводит id, node_name и node_comment перед остальными полями")
    fun `orders node metadata fields before other fields`() {
        val formatted = formattingService.format(
            """
            context-code: CHANGE
            disabled: false
            node_comment: Описание процесса
            subprocess:
              - disabled: false
                stages:
                  - executor: executor_1
                    node_comment: Описание stage
                    id: stage-1
                    node_name: Stage
                node_comment: Описание subprocess
                id: subprocess-1
                node_name: Subprocess
            id: process-1
            node_name: Process
            """.trimIndent()
        )

        assertEquals(
            """
            id: process-1
            node_name: Process
            node_comment: Описание процесса
            context-code: CHANGE
            disabled: false
            subprocess:
              - id: subprocess-1
                node_name: Subprocess
                node_comment: Описание subprocess
                disabled: false
                stages:
                  - id: stage-1
                    node_name: Stage
                    node_comment: Описание stage
                    executor: executor_1
            """.trimIndent() + "\n",
            formatted
        )
    }

    @Test
    @DisplayName("Всегда выводит JsonLogic правила literal block scalar через |-")
    fun `formats json logic rules as literal block scalars`() {
        val formatted = formattingService.format(
            """
            trigger:
              rule: '{ "var": "events" }'
            configurator:
              filter-event-rule: '{ "==": [ { "var": "body.service.scenario" }, "DealStructuring" ] }'
              result:
                - reverse:
                    - output:
                        - rule: '{ "some": [ { "var": "events" }, true ] }'
            """.trimIndent()
        )

        assertEquals(
            """
            trigger:
              rule: |-
                { "var": "events" }
            configurator:
              filter-event-rule: |-
                { "==": [ { "var": "body.service.scenario" }, "DealStructuring" ] }
              result:
                - reverse:
                    - output:
                        - rule: |-
                            { "some": [ { "var": "events" }, true ] }
            """.trimIndent() + "\n",
            formatted
        )
    }
}
