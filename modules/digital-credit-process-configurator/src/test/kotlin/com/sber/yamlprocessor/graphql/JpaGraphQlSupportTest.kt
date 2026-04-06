package com.sber.yamlprocessor.graphql

import com.fasterxml.jackson.databind.ObjectMapper
import com.sber.yamlprocessor.model.ActionPhasesDictionary
import com.sber.yamlprocessor.model.B3StatusDictionary
import com.sber.yamlprocessor.model.Result
import com.sber.yamlprocessor.model.Reverse
import com.sber.yamlprocessor.model.ReverseOutput
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.graphql.execution.GraphQlSource

@SpringBootTest
class JpaGraphQlSupportTest {

    @Autowired
    lateinit var graphQlSource: GraphQlSource

    @Autowired
    lateinit var objectMapper: ObjectMapper

    @Autowired
    lateinit var registry: JpaGraphQlRegistry

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
        assertTrue(schema.mutationType.fieldDefinitions.any { it.name == "deleteReverseNode" })
        assertTrue(schema.mutationType.fieldDefinitions.any { it.name == "createReverseOutputNode" })
        assertTrue(schema.mutationType.fieldDefinitions.any { it.name == "updateReverseOutputNode" })
        assertTrue(schema.mutationType.fieldDefinitions.any { it.name == "deleteReverseOutputNode" })
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
                    "service" to mapOf("scenario" to "service-scenario")
                ),
                "log" to mapOf(
                    "journalServiceName" to "journal-name",
                    "message" to "log-message"
                )
            ),
            ReverseOutput::class.java
        )

        assertEquals("body-type", output.body.type)
        assertEquals("event-type", output.body.eventObject?.type)
        assertEquals("service-scenario", output.body.service?.scenario)
        assertEquals("journal-name", output.log.journalServiceName)
        assertEquals("log-message", output.log.message)
    }

    @Test
    fun `uses declared dictionary types for reference fields`() {
        val reverseStatusField = registry.entity(Reverse::class.java).fields.first { it.name == "status" }
        val reverseOutputPhaseField = registry.entity(ReverseOutput::class.java).fields.first { it.name == "phase" }

        assertEquals(B3StatusDictionary::class.java, reverseStatusField.targetClass)
        assertEquals(ActionPhasesDictionary::class.java, reverseOutputPhaseField.targetClass)
    }
}
