package com.sber.yamlprocessor.mcp

import io.modelcontextprotocol.server.McpServerFeatures
import io.modelcontextprotocol.spec.McpSchema
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class McpServerConfiguration(
    private val toolService: JpaMcpToolService
) {
    @Bean
    fun yamlProcessorTools(): List<McpServerFeatures.SyncToolSpecification> =
        toolService.listTools().map { tool ->
            McpServerFeatures.SyncToolSpecification(
                McpSchema.Tool(
                    tool.name,
                    tool.name,
                    tool.description,
                    tool.inputSchema.toJsonSchema(),
                    emptyMap(),
                    null,
                    emptyMap()
                )
            ) { _, arguments ->
                try {
                    val result = toolService.callTool(tool.name, arguments)
                    McpSchema.CallToolResult(
                        listOf(McpSchema.TextContent(toolService.toJson(result))),
                        false,
                        toolService.toJsonCompatibleValue(result),
                        emptyMap()
                    )
                } catch (exception: Exception) {
                    McpSchema.CallToolResult(exception.message ?: "MCP tool execution failed", true)
                }
            }
        }

    @Suppress("UNCHECKED_CAST")
    private fun Map<String, Any?>.toJsonSchema(): McpSchema.JsonSchema =
        McpSchema.JsonSchema(
            this["type"]?.toString() ?: "object",
            this["properties"] as? Map<String, Any> ?: emptyMap(),
            this["required"] as? List<String> ?: emptyList(),
            this["additionalProperties"] as? Boolean ?: false,
            emptyMap(),
            emptyMap()
        )
}
