package com.sber.yamlprocessor.mcp

import com.fasterxml.jackson.databind.ObjectMapper
import com.sber.yamlprocessor.graphql.JpaGraphQlRegistry
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MvcResult
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.post
import java.util.UUID

@SpringBootTest(
    properties = [
        "spring.datasource.url=jdbc:h2:mem:mcp_test;MODE=PostgreSQL;DB_CLOSE_DELAY=-1"
    ]
)
@AutoConfigureMockMvc
class SpringMcpServerIntegrationTest {

    @Autowired
    lateinit var mockMvc: MockMvc

    @Autowired
    lateinit var objectMapper: ObjectMapper

    @Autowired
    lateinit var registry: JpaGraphQlRegistry

    private var mcpSessionId: String? = null

    @Test
    fun `initializes mcp server and lists graphql-equivalent tools`() {
        val initialize = postMcp(
            mapOf(
                "jsonrpc" to "2.0",
                "id" to 1,
                "method" to "initialize",
                "params" to initializeParams()
            )
        )

        assertEquals("yaml-processor", initialize.at("/result/serverInfo/name").asText())
        assertTrue(initialize.at("/result/protocolVersion").asText().isNotBlank())

        val toolsResponse = postMcp(
            mapOf(
                "jsonrpc" to "2.0",
                "id" to 2,
                "method" to "tools/list"
            )
        )
        val toolNames = toolsResponse.at("/result/tools").map { it.get("name").asText() }.toSet()

        assertTrue(toolNames.contains("processConfig"))
        assertTrue(toolNames.contains("processConfigList"))
        assertTrue(toolNames.contains("createProcessConfig"))
        assertTrue(toolNames.contains("updateStageNode"))
        assertTrue(toolNames.contains("reorderReverseOutputs"))
        assertTrue(toolNames.contains("deleteReverseOutputNode"))
        assertTrue(toolNames.contains("createContextCodesDictionary"))

        val expectedDynamicTools = registry.entities.values.sumOf { entity ->
            2 + if (entity.mutable) 3 else 0
        }
        val customTools = 23
        assertEquals(expectedDynamicTools + customTools, toolNames.size)
        assertTrue(toolNames.contains("validateEvent"))
        assertTrue(toolNames.contains("searchProcesses"))
    }

    @Test
    fun `calls mcp tools to create and update process graph`() {
        val created = callTool(
            id = 10,
            name = "createProcessConfig",
            arguments = mapOf(
                "input" to mapOf(
                    "process" to mapOf(
                        "nodeName" to "MCP process",
                        "contextCode" to mapOf("code" to "PSPLUS"),
                        "subprocess" to listOf(
                            mapOf(
                                "nodeName" to "MCP subprocess",
                                "trigger" to mapOf("rule" to "{\"==\":[1,1]}"),
                                "stages" to listOf(
                                    mapOf(
                                        "executor" to "executor.alpha",
                                        "nodeName" to "Initial stage",
                                        "configurator" to mapOf("filterEventRule" to "")
                                    )
                                )
                            )
                        )
                    )
                )
            )
        )

        val processConfigId = created.at("/id").asText()
        val stageId = created.at("/process/subprocess/0/stages/0/id").asText()
        val configuratorId = created.at("/process/subprocess/0/stages/0/configurator/id").asText()
        assertNotNull(UUID.fromString(processConfigId))
        assertNotNull(UUID.fromString(stageId))
        assertNotNull(UUID.fromString(configuratorId))
        assertEquals("executor.alpha", created.at("/process/subprocess/0/stages/0/executor").asText())

        val updated = callTool(
            id = 11,
            name = "updateStageNode",
            arguments = mapOf(
                "id" to stageId,
                "input" to mapOf(
                    "executor" to "executor.beta",
                    "nodeName" to "Updated stage",
                    "nodeComment" to "Updated through MCP",
                    "contextCode" to mapOf("code" to "C7M"),
                    "log" to mapOf("journalServiceName" to "journal.mcp")
                )
            )
        )

        assertEquals("executor.beta", updated.at("/executor").asText())
        assertEquals("Updated stage", updated.at("/nodeName").asText())
        assertEquals("C7M", updated.at("/contextCode/code").asText())
        assertEquals("journal.mcp", updated.at("/log/journalServiceName").asText())

        val result = callTool(
            id = 12,
            name = "createResultNode",
            arguments = mapOf(
                "configuratorId" to configuratorId,
                "input" to mapOf("inputScenarios" to listOf("scenario.mcp"))
            )
        )
        val resultId = result.at("/id").asText()
        assertNotNull(UUID.fromString(resultId))

        val reverse = callTool(
            id = 13,
            name = "createReverseNode",
            arguments = mapOf(
                "resultId" to resultId,
                "input" to mapOf("status" to mapOf("code" to "INITIATED"))
            )
        )
        val reverseId = reverse.at("/id").asText()
        assertNotNull(UUID.fromString(reverseId))

        val output = callTool(
            id = 14,
            name = "createReverseOutputNode",
            arguments = mapOf(
                "reverseId" to reverseId,
                "input" to mapOf(
                    "phase" to mapOf("code" to "START"),
                    "body" to mapOf(
                        "type" to "SERVICE",
                        "service" to mapOf("scenario" to "scenario.mcp")
                    ),
                    "parent" to mapOf(
                        "include" to true,
                        "mode" to "DEEP"
                    )
                )
            )
        )

        assertEquals(true, output.at("/parent/include").asBoolean())
        assertEquals("DEEP", output.at("/parent/mode").asText())

        val validation = callTool(
            id = 15,
            name = "validateEvent",
            arguments = mapOf(
                "processConfigId" to processConfigId,
                "event" to mapOf(
                    "b3event" to mapOf(
                        "body" to mapOf(
                            "service" to mapOf("scenario" to "scenario.mcp")
                        )
                    )
                )
            )
        )

        assertEquals(true, validation.at("/matched").asBoolean())
        assertEquals("scenario.mcp", validation.at("/scenario").asText())
        assertEquals(true, validation.at("/processConfigs/0/process/subprocess/0/stages/0/results/0/scenarioMatched").asBoolean())
        assertEquals("DEEP", validation.at("/processConfigs/0/process/subprocess/0/stages/0/results/0/reverse/0/outputs/0/parent/mode").asText())

        val allProcesses = callTool(
            id = 16,
            name = "searchProcesses",
            arguments = emptyMap()
        )
        assertTrue(allProcesses.size() >= 1)

        val searchedProcesses = callTool(
            id = 17,
            name = "searchProcesses",
            arguments = mapOf("query" to "MCP")
        )
        assertEquals(processConfigId, searchedProcesses.at("/0/processConfigId").asText())
        assertEquals("MCP process", searchedProcesses.at("/0/nodeName").asText())
    }

    private fun callTool(id: Int, name: String, arguments: Map<String, Any?>) =
        readToolContent(
            postMcp(
                mapOf(
                    "jsonrpc" to "2.0",
                    "id" to id,
                    "method" to "tools/call",
                    "params" to mapOf(
                        "name" to name,
                        "arguments" to arguments
                    )
                )
            )
        )

    private fun readToolContent(response: com.fasterxml.jackson.databind.JsonNode): com.fasterxml.jackson.databind.JsonNode {
        assertEquals(false, response.at("/result/isError").asBoolean(false))
        val text = response.at("/result/content/0/text").asText()
        assertTrue(text.isNotBlank())
        return objectMapper.readTree(text)
    }

    private fun postMcp(payload: Map<String, Any?>): com.fasterxml.jackson.databind.JsonNode {
        if (payload["method"] != "initialize" && mcpSessionId == null) {
            postMcp(
                mapOf(
                    "jsonrpc" to "2.0",
                    "id" to 0,
                    "method" to "initialize",
                    "params" to initializeParams()
                )
            )
        }

        val result: MvcResult = mockMvc.post("/mcp") {
            contentType = MediaType.APPLICATION_JSON
            accept(MediaType.APPLICATION_JSON, MediaType.TEXT_EVENT_STREAM)
            mcpSessionId?.let { header("Mcp-Session-Id", it) }
            content = objectMapper.writeValueAsString(payload)
        }
            .andExpect {
                status { isOk() }
            }
            .andReturn()

        result.response.getHeader("Mcp-Session-Id")?.let { mcpSessionId = it }

        return objectMapper.readTree(extractJsonPayload(result.response.contentAsString))
    }

    private fun extractJsonPayload(content: String): String {
        val trimmed = content.trim()
        if (trimmed.startsWith("{")) {
            return trimmed
        }

        return trimmed.lineSequence()
            .filter { it.startsWith("data:") }
            .joinToString(separator = "\n") { it.removePrefix("data:").trimStart() }
            .ifBlank { trimmed }
    }

    private fun initializeParams(): Map<String, Any?> =
        mapOf(
            "protocolVersion" to "2025-03-26",
            "capabilities" to emptyMap<String, Any>(),
            "clientInfo" to mapOf(
                "name" to "yaml-processor-integration-test",
                "version" to "1.0.0"
            )
        )
}
