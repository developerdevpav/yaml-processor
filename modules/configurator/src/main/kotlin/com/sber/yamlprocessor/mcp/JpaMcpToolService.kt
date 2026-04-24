package com.sber.yamlprocessor.mcp

import com.fasterxml.jackson.databind.ObjectMapper
import com.sber.yamlprocessor.graphql.EntityMetadata
import com.sber.yamlprocessor.graphql.JpaGraphQlCrudService
import com.sber.yamlprocessor.graphql.JpaGraphQlRegistry
import org.springframework.stereotype.Service

@Service
class JpaMcpToolService(
    private val registry: JpaGraphQlRegistry,
    private val crudService: JpaGraphQlCrudService,
    private val resultMapper: JpaMcpResultMapper,
    private val eventValidationService: McpEventValidationService,
    private val processSearchService: McpProcessSearchService,
    private val objectMapper: ObjectMapper
) {
    private val entityByToolName: Map<String, Pair<EntityMetadata, ToolOperation>>
        get() = registry.entities.values.flatMap { entity ->
            buildList {
                add(entity.queryField to (entity to ToolOperation.FIND_BY_ID))
                add(entity.listField to (entity to ToolOperation.FIND_ALL))
                if (entity.mutable) {
                    add("create${entity.name}" to (entity to ToolOperation.CREATE))
                    add("update${entity.name}" to (entity to ToolOperation.UPDATE))
                    add("delete${entity.name}" to (entity to ToolOperation.DELETE))
                }
            }
        }.toMap()

    fun listTools(): List<McpTool> {
        val entityTools = registry.entities.values.flatMap { entity ->
            buildList {
                add(
                    McpTool(
                        name = entity.queryField,
                        description = "Find ${entity.name} by id.",
                        inputSchema = objectSchema(required = listOf("id"), properties = mapOf("id" to idSchema()))
                    )
                )
                add(
                    McpTool(
                        name = entity.listField,
                        description = "List all ${entity.name} entities.",
                        inputSchema = objectSchema()
                    )
                )
                if (entity.mutable) {
                    add(
                        McpTool(
                            name = "create${entity.name}",
                            description = "Create ${entity.name}. Input shape matches GraphQL ${entity.inputName}.",
                            inputSchema = inputToolSchema()
                        )
                    )
                    add(
                        McpTool(
                            name = "update${entity.name}",
                            description = "Update ${entity.name} by id. Input shape matches GraphQL ${entity.inputName}.",
                            inputSchema = idAndInputToolSchema()
                        )
                    )
                    add(
                        McpTool(
                            name = "delete${entity.name}",
                            description = "Delete ${entity.name} by id.",
                            inputSchema = objectSchema(required = listOf("id"), properties = mapOf("id" to idSchema()))
                        )
                    )
                }
            }
        }

        return entityTools + listOf(
            customTool("createSubprocessNode", "Create Subprocess under Process.", "processId", "input"),
            customTool("updateSubprocessNode", "Update Subprocess node fields.", "id", "input"),
            customTool("reorderSubprocessStages", "Reorder Stage nodes inside Subprocess.", "subprocessId", "stageIds", arrayProperty = "stageIds"),
            customTool("deleteSubprocessNode", "Delete Subprocess node.", "id"),
            customTool("createStageNode", "Create Stage under Subprocess.", "subprocessId", "input"),
            customTool("updateStageNode", "Update Stage node fields.", "id", "input"),
            customTool("deleteStageNode", "Delete Stage node.", "id"),
            customTool("createConfiguratorNode", "Create Configurator under Stage.", "stageId", "input"),
            customTool("updateConfiguratorNode", "Update Configurator node fields.", "id", "input"),
            customTool("deleteConfiguratorNode", "Delete Configurator node.", "id"),
            customTool("createResultNode", "Create Result under Configurator.", "configuratorId", "input"),
            customTool("updateResultNode", "Update Result node fields.", "id", "input"),
            customTool("deleteResultNode", "Delete Result node.", "id"),
            customTool("createReverseNode", "Create Reverse under Result.", "resultId", "input"),
            customTool("updateReverseNode", "Update Reverse node fields.", "id", "input"),
            customTool("reorderReverseOutputs", "Reorder ReverseOutput nodes inside Reverse.", "reverseId", "outputIds", arrayProperty = "outputIds"),
            customTool("deleteReverseNode", "Delete Reverse node.", "id"),
            customTool("createReverseOutputNode", "Create ReverseOutput under Reverse.", "reverseId", "input"),
            customTool("updateReverseOutputNode", "Update ReverseOutput node fields.", "id", "input"),
            customTool("deleteReverseOutputNode", "Delete ReverseOutput node.", "id"),
            customTool("updateProcessNode", "Update Process node fields.", "id", "input"),
            McpTool(
                name = "validateEvent",
                description = "Validate an incoming event against configured processes, scenarios, and JsonLogic rules.",
                inputSchema = objectSchema(
                    required = listOf("event"),
                    properties = mapOf(
                        "event" to mapOf("type" to "object", "additionalProperties" to true),
                        "processConfigId" to idSchema(),
                        "includeNonMatches" to mapOf("type" to "boolean")
                    )
                )
            ),
            McpTool(
                name = "searchProcesses",
                description = "Return all processes or search processes by approximate name, description, id, processConfigId, or context code.",
                inputSchema = objectSchema(
                    properties = mapOf(
                        "query" to mapOf("type" to "string")
                    )
                )
            )
        )
    }

    fun callTool(name: String, arguments: Map<String, Any?>): Any? {
        val result = callGraphQlEquivalent(name, arguments)
        return resultMapper.toMcpValue(result)
    }

    fun callToolAsJson(name: String, arguments: Map<String, Any?>): String =
        objectMapper.writeValueAsString(callTool(name, arguments))

    fun toJson(value: Any?): String =
        objectMapper.writeValueAsString(value)

    fun toJsonCompatibleValue(value: Any?): Any? =
        objectMapper.readValue(toJson(value), Any::class.java)

    private fun callGraphQlEquivalent(name: String, arguments: Map<String, Any?>): Any? {
        entityByToolName[name]?.let { (entity, operation) ->
            return when (operation) {
                ToolOperation.FIND_BY_ID -> crudService.findById(entity, arguments["id"])
                ToolOperation.FIND_ALL -> crudService.findAll(entity)
                ToolOperation.CREATE -> crudService.create(entity, input(arguments))
                ToolOperation.UPDATE -> crudService.update(entity, arguments["id"], input(arguments))
                ToolOperation.DELETE -> crudService.delete(entity, arguments["id"])
            }
        }

        return when (name) {
            "createSubprocessNode" -> crudService.createSubprocessNode(arguments["processId"], input(arguments))
            "updateSubprocessNode" -> crudService.updateSubprocessNode(arguments["id"], input(arguments))
            "reorderSubprocessStages" -> crudService.reorderSubprocessStages(arguments["subprocessId"], idList(arguments, "stageIds"))
            "deleteSubprocessNode" -> crudService.deleteSubprocessNode(arguments["id"])
            "createStageNode" -> crudService.createStageNode(arguments["subprocessId"], input(arguments))
            "updateStageNode" -> crudService.updateStageNode(arguments["id"], input(arguments))
            "deleteStageNode" -> crudService.deleteStageNode(arguments["id"])
            "createConfiguratorNode" -> crudService.createConfiguratorNode(arguments["stageId"], input(arguments))
            "updateConfiguratorNode" -> crudService.updateConfiguratorNode(arguments["id"], input(arguments))
            "deleteConfiguratorNode" -> crudService.deleteConfiguratorNode(arguments["id"])
            "createResultNode" -> crudService.createResultNode(arguments["configuratorId"], input(arguments))
            "updateResultNode" -> crudService.updateResultNode(arguments["id"], input(arguments))
            "deleteResultNode" -> crudService.deleteResultNode(arguments["id"])
            "createReverseNode" -> crudService.createReverseNode(arguments["resultId"], input(arguments))
            "updateReverseNode" -> crudService.updateReverseNode(arguments["id"], input(arguments))
            "reorderReverseOutputs" -> crudService.reorderReverseOutputs(arguments["reverseId"], idList(arguments, "outputIds"))
            "deleteReverseNode" -> crudService.deleteReverseNode(arguments["id"])
            "createReverseOutputNode" -> crudService.createReverseOutputNode(arguments["reverseId"], input(arguments))
            "updateReverseOutputNode" -> crudService.updateReverseOutputNode(arguments["id"], input(arguments))
            "deleteReverseOutputNode" -> crudService.deleteReverseOutputNode(arguments["id"])
            "updateProcessNode" -> crudService.updateProcessNode(arguments["id"], input(arguments))
            "validateEvent" -> eventValidationService.validate(arguments)
            "searchProcesses" -> processSearchService.search(arguments)
            else -> error("Unknown MCP tool: $name")
        }
    }

    @Suppress("UNCHECKED_CAST")
    private fun input(arguments: Map<String, Any?>): Map<String, Any?> =
        normalizeInput(arguments["input"] as? Map<String, Any?> ?: emptyMap())

    private fun idList(arguments: Map<String, Any?>, name: String): List<Any?> =
        (arguments[name] as? List<*>)?.toList() ?: emptyList()

    @Suppress("UNCHECKED_CAST")
    private fun normalizeInput(input: Map<String, Any?>): Map<String, Any?> =
        input.entries.fold(linkedMapOf<String, Any?>()) { normalized, (key, value) ->
            val normalizedValue = when (value) {
                is Map<*, *> -> normalizeInput(value as Map<String, Any?>)
                is List<*> -> value.map { item ->
                    if (item is Map<*, *>) {
                        normalizeInput(item as Map<String, Any?>)
                    } else {
                        item
                    }
                }
                else -> value
            }
            normalized[key] = normalizedValue
            val snakeKey = key.replace(Regex("([a-z0-9])([A-Z])"), "$1_$2").lowercase()
            if (snakeKey != key) {
                normalized[snakeKey] = normalizedValue
            }
            normalized
        }

    private fun customTool(
        name: String,
        description: String,
        vararg required: String,
        arrayProperty: String? = null
    ): McpTool {
        val properties = required.associateWith { property ->
            when {
                property == arrayProperty -> mapOf("type" to "array", "items" to idSchema())
                property == "input" -> mapOf("type" to "object", "additionalProperties" to true)
                else -> idSchema()
            }
        }
        return McpTool(name, description, objectSchema(required = required.toList(), properties = properties))
    }

    private fun inputToolSchema(): Map<String, Any?> =
        objectSchema(
            required = listOf("input"),
            properties = mapOf("input" to mapOf("type" to "object", "additionalProperties" to true))
        )

    private fun idAndInputToolSchema(): Map<String, Any?> =
        objectSchema(
            required = listOf("id", "input"),
            properties = mapOf(
                "id" to idSchema(),
                "input" to mapOf("type" to "object", "additionalProperties" to true)
            )
        )

    private fun objectSchema(
        required: List<String> = emptyList(),
        properties: Map<String, Any?> = emptyMap()
    ): Map<String, Any?> = buildMap {
        put("type", "object")
        put("properties", properties)
        if (required.isNotEmpty()) {
            put("required", required)
        }
        put("additionalProperties", false)
    }

    private fun idSchema(): Map<String, String> = mapOf("type" to "string")
}

private enum class ToolOperation {
    FIND_BY_ID,
    FIND_ALL,
    CREATE,
    UPDATE,
    DELETE
}
