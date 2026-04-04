package com.sber.yamlprocessor.graphql

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

    @Test
    fun `builds graphql schema from jpa model`() {
        val schema = graphQlSource.schema()
        assertNotNull(schema.getType("Process"))
        assertNotNull(schema.queryType.getFieldDefinition("process"))
        assertNotNull(schema.queryType.getFieldDefinition("processList"))
        assertTrue(schema.mutationType.fieldDefinitions.any { it.name == "createProcess" })
        assertTrue(schema.mutationType.fieldDefinitions.any { it.name == "createSubprocessNode" })
        assertTrue(schema.mutationType.fieldDefinitions.any { it.name == "updateSubprocessNode" })
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
}
