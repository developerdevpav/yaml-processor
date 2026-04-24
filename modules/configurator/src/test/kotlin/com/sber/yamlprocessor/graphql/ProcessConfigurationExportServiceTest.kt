package com.sber.yamlprocessor.graphql

import com.sber.yamlprocessor.export.ProcessConfigurationExportType
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import com.sber.yamlprocessor.model.Configurator
import com.sber.yamlprocessor.model.Process
import com.sber.yamlprocessor.model.ProcessConfig
import com.sber.yamlprocessor.model.Result
import com.sber.yamlprocessor.model.Reverse
import com.sber.yamlprocessor.model.ReverseOutput
import com.sber.yamlprocessor.model.Body
import com.sber.yamlprocessor.model.EventLog
import com.sber.yamlprocessor.model.Parent
import com.sber.yamlprocessor.model.ParentMode
import com.sber.yamlprocessor.model.Service
import com.sber.yamlprocessor.model.SlaState
import com.sber.yamlprocessor.model.SlaDurationUnitDictionary
import com.sber.yamlprocessor.model.SlaStatusDictionary
import com.sber.yamlprocessor.model.Stage
import com.sber.yamlprocessor.model.Subprocess
import com.sber.yamlprocessor.model.Trigger
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.Mockito.mock

class ProcessConfigurationExportServiceTest {

    private val crudService = mock(JpaGraphQlCrudService::class.java)
    private val objectMapper: ObjectMapper = ObjectMapper().findAndRegisterModules().registerKotlinModule()
    private val exportService = ProcessConfigurationExportService(crudService, objectMapper)

    @Test
    fun `exports filter event rule as literal block scalar`() {
        val output = ReverseOutput(
            rule = "event != null\nevent.amount > 0",
            body = Body(
                service = Service(
                    scenario = "scenario_a",
                    type = "",
                    status = null,
                    sla = SlaState(
                        status = SlaStatusDictionary(code = "INIT"),
                        durationValue = 15,
                        durationUnit = SlaDurationUnitDictionary(code = "MINUTES")
                    )
                ),
                type = "SERVICE"
            ),
            log = EventLog(journalServiceName = ""),
            parent = Parent(include = true, mode = ParentMode.SURFACE)
        )
        val reverse = Reverse(output = mutableListOf(output))
        output.reverse = reverse
        val result = Result(reverse = mutableListOf(reverse))
        reverse.result = result
        val configurator = Configurator(
            filterEventRule = "payload != null\npayload.type == 'A'",
            result = mutableListOf(result)
        )
        result.configurator = configurator
        val stage = Stage(
            executor = "executor.alpha",
            configurator = configurator
        )
        configurator.stage = stage
        val subprocessNode = Subprocess(
            nodeName = "subprocess_alpha",
            trigger = Trigger(rule = "payload != null\npayload.type == 'A'")
        )
        stage.subprocess = subprocessNode
        subprocessNode.stages = mutableListOf(stage)

        val processConfig = ProcessConfig().apply {
            process = Process(processConfig = this, nodeName = "process_alpha").apply {
                subprocessNode.process = this
                subprocess = mutableListOf(subprocessNode)
            }
        }

        given(crudService.findProcessConfigForExport("config-1")).willReturn(processConfig)

        val exported = exportService.exportProcessConfig("config-1")

        assertTrue(
            Regex("""filter-event-rule:\s+\|-\s+payload != null\s+payload\.type == 'A'""")
                .containsMatchIn(exported.content),
            exported.content
        )
        assertTrue(
            Regex("""trigger:\s+rule:\s+\|-\s+payload != null\s+payload\.type == 'A'""")
                .containsMatchIn(exported.content),
            exported.content
        )
        assertTrue(
            Regex("""output:\s+-\s+phase: START\s+rule:\s+\|-\s+event != null\s+event\.amount > 0""")
                .containsMatchIn(exported.content),
            exported.content
        )
        assertTrue(exported.content.contains("scenario: scenario_a"), exported.content)
        assertTrue(exported.content.contains("sla:"), exported.content)
        assertTrue(exported.content.contains("type: SERVICE"), exported.content)
        assertTrue(exported.content.contains("duration_value: 15"), exported.content)
        assertTrue(exported.content.contains("duration_unit: MINUTES"), exported.content)
        assertTrue(exported.content.contains("parent:"), exported.content)
        assertTrue(exported.content.contains("include: true"), exported.content)
        assertTrue(exported.content.contains("mode: SURFACE"), exported.content)
        assertFalse(exported.content.contains("type: null"), exported.content)
        assertFalse(exported.content.contains("journal-service-name: null"), exported.content)
        assertFalse(exported.content.contains("status: null"), exported.content)
    }

    @Test
    fun `exports legacy schema with description from node name and without ids`() {
        val output = ReverseOutput(
            log = EventLog(journalServiceName = ""),
            body = Body(
                service = Service(
                    scenario = "scenario_a",
                    type = "",
                    sla = SlaState(
                        status = SlaStatusDictionary(code = "INIT"),
                        durationValue = 15,
                        durationUnit = SlaDurationUnitDictionary(code = "MINUTES")
                    )
                ),
                type = "SERVICE"
            )
        )
        val reverse = Reverse(output = mutableListOf(output))
        output.reverse = reverse
        val result = Result(reverse = mutableListOf(reverse))
        reverse.result = result
        val configurator = Configurator(result = mutableListOf(result))
        result.configurator = configurator
        val stage = Stage(executor = "executor.alpha", configurator = configurator)
        configurator.stage = stage
        val subprocessNode = Subprocess(nodeName = "subprocess name", nodeComment = "subprocess comment", trigger = Trigger(rule = "payload != null"))
        stage.subprocess = subprocessNode
        subprocessNode.stages = mutableListOf(stage)
        val processConfig = ProcessConfig().apply {
            process = Process(processConfig = this, nodeName = "process name", nodeComment = "process comment").apply {
                subprocessNode.process = this
                subprocess = mutableListOf(subprocessNode)
            }
        }

        given(crudService.findProcessConfigForExport("config-legacy")).willReturn(processConfig)

        val exported = exportService.exportProcessConfig(
            "config-legacy",
            ProcessConfigurationExportType.LEGACY
        )

        assertTrue(exported.content.contains("durationValue: 15"), exported.content)
        assertTrue(exported.content.contains("durationUnit: MINUTES"), exported.content)
        assertFalse(exported.content.contains("duration_value:"), exported.content)
        assertFalse(exported.content.contains("duration_unit:"), exported.content)
        assertTrue(exported.content.contains("description: process name"), exported.content)
        assertTrue(exported.content.contains("description: subprocess name"), exported.content)
        assertFalse(exported.content.contains("process comment"), exported.content)
        assertFalse(exported.content.contains("subprocess comment"), exported.content)
        assertFalse(exported.content.contains("\nid:"), exported.content)
        assertFalse(exported.content.contains("node_name"), exported.content)
        assertFalse(exported.content.contains("nodeName"), exported.content)
        assertFalse(exported.content.contains("node_comment"), exported.content)
        assertFalse(exported.content.contains("nodeComment"), exported.content)
        assertFalse(exported.content.contains("type: null"), exported.content)
        assertFalse(exported.content.contains("journal-service-name: null"), exported.content)
        assertFalse(exported.content.contains("type: ''"), exported.content)
        assertFalse(exported.content.contains("journal-service-name: ''"), exported.content)
    }
}
