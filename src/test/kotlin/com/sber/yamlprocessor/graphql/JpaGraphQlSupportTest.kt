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
        assertTrue(schema.mutationType.fieldDefinitions.any { it.name == "updateStageNode" })
    }
}
