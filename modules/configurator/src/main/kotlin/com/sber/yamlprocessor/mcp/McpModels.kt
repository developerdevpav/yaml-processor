package com.sber.yamlprocessor.mcp

import com.fasterxml.jackson.annotation.JsonProperty

data class McpJsonRpcRequest(
    val jsonrpc: String? = null,
    val id: Any? = null,
    val method: String? = null,
    val params: Map<String, Any?>? = null
)

data class McpJsonRpcResponse(
    val jsonrpc: String = "2.0",
    val id: Any?,
    val result: Any? = null,
    val error: McpJsonRpcError? = null
)

data class McpJsonRpcError(
    val code: Int,
    val message: String,
    val data: Any? = null
)

data class McpTool(
    val name: String,
    val description: String,
    @field:JsonProperty("inputSchema")
    val inputSchema: Map<String, Any?>
)

data class McpToolCallResult(
    val content: List<McpContent>,
    @field:JsonProperty("structuredContent")
    val structuredContent: Any? = null,
    @field:JsonProperty("isError")
    val isError: Boolean = false
)

data class McpContent(
    val type: String = "text",
    val text: String
)
