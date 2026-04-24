package com.sber.yamlprocessor.graphql

import com.fasterxml.jackson.databind.ObjectMapper
import com.sber.yamlprocessor.model.ActionPhasesDictionary
import com.sber.yamlprocessor.model.B3StatusDictionary
import com.sber.yamlprocessor.model.ContextCodesDictionary
import com.sber.yamlprocessor.model.ParentMode
import com.sber.yamlprocessor.model.Process
import com.sber.yamlprocessor.model.ProcessConfig
import com.sber.yamlprocessor.model.Configurator
import com.sber.yamlprocessor.model.Result
import com.sber.yamlprocessor.model.Reverse
import com.sber.yamlprocessor.model.ReverseOutput
import com.sber.yamlprocessor.model.Service
import com.sber.yamlprocessor.model.SlaStatusDictionary
import com.sber.yamlprocessor.model.Stage
import com.sber.yamlprocessor.model.Subprocess
import jakarta.persistence.EntityManager
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.graphql.execution.GraphQlSource
import org.springframework.transaction.annotation.Transactional

@SpringBootTest
class JpaGraphQlSupportTest {

    @Autowired
    lateinit var graphQlSource: GraphQlSource

    @Autowired
    lateinit var objectMapper: ObjectMapper

    @Autowired
    lateinit var registry: JpaGraphQlRegistry

    @Autowired
    lateinit var crudService: JpaGraphQlCrudService

    @Autowired
    lateinit var entityManager: EntityManager

    @Test
    fun `builds graphql schema from jpa model`() {
        val schema = graphQlSource.schema()
        assertNotNull(schema.getType("Process"))
        assertNotNull(schema.queryType.getFieldDefinition("process"))
        assertNotNull(schema.queryType.getFieldDefinition("processList"))
        assertTrue(schema.mutationType.fieldDefinitions.any { it.name == "createProcess" })
        assertTrue(schema.mutationType.fieldDefinitions.any { it.name == "createSubprocessNode" })
        assertTrue(schema.mutationType.fieldDefinitions.any { it.name == "updateSubprocessNode" })
        assertTrue(schema.mutationType.fieldDefinitions.any { it.name == "reorderSubprocessStages" })
        assertTrue(schema.mutationType.fieldDefinitions.any { it.name == "deleteSubprocessNode" })
        assertTrue(schema.mutationType.fieldDefinitions.any { it.name == "createStageNode" })
        assertTrue(schema.mutationType.fieldDefinitions.any { it.name == "updateProcessNode" })
        assertTrue(schema.mutationType.fieldDefinitions.any { it.name == "updateStageNode" })
        assertTrue(schema.mutationType.fieldDefinitions.any { it.name == "deleteStageNode" })
        assertTrue(schema.mutationType.fieldDefinitions.any { it.name == "createConfiguratorNode" })
        assertTrue(schema.mutationType.fieldDefinitions.any { it.name == "updateConfiguratorNode" })
        assertTrue(schema.mutationType.fieldDefinitions.any { it.name == "deleteConfiguratorNode" })
        assertTrue(schema.mutationType.fieldDefinitions.any { it.name == "createResultNode" })
        assertTrue(schema.mutationType.fieldDefinitions.any { it.name == "updateResultNode" })
        assertTrue(schema.mutationType.fieldDefinitions.any { it.name == "deleteResultNode" })
        assertTrue(schema.mutationType.fieldDefinitions.any { it.name == "createReverseNode" })
        assertTrue(schema.mutationType.fieldDefinitions.any { it.name == "updateReverseNode" })
        assertTrue(schema.mutationType.fieldDefinitions.any { it.name == "reorderReverseOutputs" })
        assertTrue(schema.mutationType.fieldDefinitions.any { it.name == "deleteReverseNode" })
        assertTrue(schema.mutationType.fieldDefinitions.any { it.name == "createReverseOutputNode" })
        assertTrue(schema.mutationType.fieldDefinitions.any { it.name == "updateReverseOutputNode" })
        assertTrue(schema.mutationType.fieldDefinitions.any { it.name == "deleteReverseOutputNode" })
        assertNotNull(schema.getType("Parent"))
        assertNotNull(schema.getType("ParentInput"))
    }

    @Test
    fun `maps graphql result input scenarios into entity`() {
        val result = objectMapper.convertValue(
            mapOf(
                "inputScenarios" to listOf("scenario-1", "scenario-2")
            ),
            Result::class.java
        )

        assertEquals(listOf("scenario-1", "scenario-2"), result.inputScenarios)
    }

    @Test
    fun `maps graphql reverse output camelCase fields into entity`() {
        val output = objectMapper.convertValue(
            mapOf(
                "name" to "output-name",
                "body" to mapOf(
                    "type" to "body-type",
                    "eventObject" to mapOf("type" to "event-type"),
                    "service" to mapOf(
                        "scenario" to "service-scenario",
                        "type" to "service-type",
                        "status" to mapOf("code" to "RUNNING")
                    )
                ),
                "log" to mapOf(
                    "journalServiceName" to "journal-name",
                    "message" to "log-message"
                ),
                "parent" to mapOf(
                    "include" to true,
                    "mode" to "SURFACE"
                )
            ),
            ReverseOutput::class.java
        )

        assertEquals("body-type", output.body.type)
        assertEquals("event-type", output.body.eventObject?.type)
        assertEquals("service-scenario", output.body.service?.scenario)
        assertEquals("service-type", output.body.service?.type)
        assertEquals("RUNNING", output.body.service?.status?.code)
        assertEquals("journal-name", output.log.journalServiceName)
        assertEquals("log-message", output.log.message)
        assertEquals(true, output.parent?.include)
        assertEquals(ParentMode.SURFACE, output.parent?.mode)
    }

    @Test
    fun `uses declared dictionary types for reference fields`() {
        val reverseStatusField = registry.entity(Reverse::class.java).fields.first { it.name == "status" }
        val reverseOutputPhaseField = registry.entity(ReverseOutput::class.java).fields.first { it.name == "phase" }
        val stageContextCodeField = registry.entity(Stage::class.java).fields.first { it.name == "contextCode" }
        val serviceStatusField = registry.complexType(Service::class.java).fields.first { it.name == "status" }
        val slaStatusField = registry.complexType(com.sber.yamlprocessor.model.SlaState::class.java).fields.first { it.name == "status" }
        val parentModeField = registry.complexType(com.sber.yamlprocessor.model.Parent::class.java).fields.first { it.name == "mode" }

        assertEquals(B3StatusDictionary::class.java, reverseStatusField.targetClass)
        assertEquals(ActionPhasesDictionary::class.java, reverseOutputPhaseField.targetClass)
        assertEquals(ContextCodesDictionary::class.java, stageContextCodeField.targetClass)
        assertEquals(B3StatusDictionary::class.java, serviceStatusField.targetClass)
        assertEquals(SlaStatusDictionary::class.java, slaStatusField.targetClass)
        assertEquals(ParentMode::class.java, parentModeField.targetClass)
    }

    @Test
    @Transactional
    fun `persists reverse output sla duration value`() {
        val processConfig = ProcessConfig()
        val process = Process(processConfig = processConfig)
        val subprocess = Subprocess(process = process)
        val stage = Stage(subprocess = subprocess, executor = "executor.alpha")
        val configurator = Configurator(stage = stage)
        val result = Result(configurator = configurator)
        val reverse = Reverse(result = result, status = B3StatusDictionary(code = "INITIATED"))
        processConfig.process = process
        process.subprocess = mutableListOf(subprocess)
        subprocess.stages = mutableListOf(stage)
        stage.configurator = configurator
        configurator.result = mutableListOf(result)
        result.reverse = mutableListOf(reverse)
        entityManager.persist(processConfig)
        entityManager.flush()

        val created = crudService.createReverseOutputNode(
            reverse.id,
            mapOf(
                "phase" to mapOf("code" to "START"),
                "body" to mapOf(
                    "service" to mapOf(
                        "scenario" to "scenario_a",
                        "sla" to mapOf(
                            "durationValue" to 15,
                            "durationUnit" to mapOf("code" to "MINUTES"),
                            "status" to mapOf("code" to "INIT")
                        )
                    ),
                    "type" to "SERVICE"
                ),
                "parent" to mapOf(
                    "include" to true,
                    "mode" to "DEEP"
                )
            )
        )

        entityManager.flush()
        entityManager.clear()

        val persisted = entityManager.find(ReverseOutput::class.java, created.id)
        assertEquals(15, persisted.body.service?.sla?.durationValue)
        assertEquals(true, persisted.parent?.include)
        assertEquals(ParentMode.DEEP, persisted.parent?.mode)

        val rawValues = entityManager.createNativeQuery(
            "select body_service_sla_duration_value, parent_include, parent_mode from reverse_output where id = :id"
        )
            .setParameter("id", created.id)
            .singleResult as Array<*>

        assertEquals(15, (rawValues[0] as Number).toInt())
        assertEquals(true, rawValues[1] as Boolean)
        assertEquals("DEEP", rawValues[2])
    }

    @Test
    @Transactional
    fun `converts blank nullable strings to null during node autosave updates`() {
        val processConfig = ProcessConfig()
        val process = Process(processConfig = processConfig)
        val subprocess = Subprocess(process = process)
        val stage = Stage(subprocess = subprocess, executor = "executor.alpha")
        val configurator = Configurator(stage = stage)
        val result = Result(configurator = configurator)
        val reverse = Reverse(result = result, status = B3StatusDictionary(code = "INITIATED"))
        val output = ReverseOutput(
            reverse = reverse,
            phase = ActionPhasesDictionary(code = "START"),
            name = "existing-name",
            rule = "existing-rule",
            body = com.sber.yamlprocessor.model.Body(
                service = Service(
                    scenario = "scenario_a",
                    type = "existing-type",
                    status = B3StatusDictionary(code = "RUNNING")
                ),
                type = "SERVICE"
            )
        )
        processConfig.process = process
        process.subprocess = mutableListOf(subprocess)
        subprocess.stages = mutableListOf(stage)
        stage.configurator = configurator
        configurator.result = mutableListOf(result)
        result.reverse = mutableListOf(reverse)
        reverse.output = mutableListOf(output)
        entityManager.persist(processConfig)
        entityManager.flush()

        crudService.updateReverseOutputNode(
            output.id,
            mapOf(
                "phase" to mapOf("code" to "START"),
                "name" to "",
                "rule" to "",
                "body" to mapOf(
                    "service" to mapOf(
                        "scenario" to "scenario_a",
                        "type" to "",
                        "status" to null
                    ),
                    "type" to "SERVICE"
                ),
                "log" to mapOf(
                    "journalServiceName" to "journal-name",
                    "message" to ""
                )
            )
        )

        entityManager.flush()
        entityManager.clear()

        val persisted = entityManager.find(ReverseOutput::class.java, output.id)
        assertNull(persisted.name)
        assertNull(persisted.rule)
        assertNull(persisted.body.service?.type)
        assertNull(persisted.body.service?.status)
        assertNull(persisted.log.message)
        assertEquals("scenario_a", persisted.body.service?.scenario)
        assertEquals("journal-name", persisted.log.journalServiceName)
    }

    @Test
    @Transactional
    fun `reorders reverse outputs`() {
        val processConfig = ProcessConfig()
        val process = Process(processConfig = processConfig)
        val subprocess = Subprocess(process = process)
        val stage = Stage(subprocess = subprocess, executor = "executor.alpha")
        val configurator = Configurator(stage = stage)
        val result = Result(configurator = configurator)
        val reverse = Reverse(result = result, status = B3StatusDictionary(code = "INITIATED"))
        val firstOutput = ReverseOutput(
            reverse = reverse,
            phase = ActionPhasesDictionary(code = "START"),
            name = "first"
        )
        val secondOutput = ReverseOutput(
            reverse = reverse,
            phase = ActionPhasesDictionary(code = "BUSINESS_COMPLETE"),
            name = "second"
        )
        processConfig.process = process
        process.subprocess = mutableListOf(subprocess)
        subprocess.stages = mutableListOf(stage)
        stage.configurator = configurator
        configurator.result = mutableListOf(result)
        result.reverse = mutableListOf(reverse)
        reverse.output = mutableListOf(firstOutput, secondOutput)
        entityManager.persist(processConfig)
        entityManager.flush()

        crudService.reorderReverseOutputs(reverse.id, listOf(secondOutput.id, firstOutput.id))

        entityManager.flush()
        entityManager.clear()

        val persisted = entityManager.find(Reverse::class.java, reverse.id)
        assertEquals(listOf("second", "first"), persisted.output.map { it.name })
    }
}
