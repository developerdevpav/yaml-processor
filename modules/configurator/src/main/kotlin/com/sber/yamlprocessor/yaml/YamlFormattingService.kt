package com.sber.yamlprocessor.yaml

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.SerializationFeature
import com.fasterxml.jackson.databind.node.ArrayNode
import com.fasterxml.jackson.databind.node.ObjectNode
import com.fasterxml.jackson.dataformat.yaml.YAMLGenerator
import com.fasterxml.jackson.dataformat.yaml.YAMLMapper
import org.springframework.stereotype.Service

@Service
class YamlFormattingService {
    private val priorityFields = listOf("id", "node_name", "node_comment")

    private val yamlMapper = YAMLMapper.builder()
        .findAndAddModules()
        .disable(YAMLGenerator.Feature.WRITE_DOC_START_MARKER)
        .enable(YAMLGenerator.Feature.MINIMIZE_QUOTES)
        .enable(YAMLGenerator.Feature.INDENT_ARRAYS_WITH_INDICATOR)
        .enable(SerializationFeature.INDENT_OUTPUT)
        .build()

    fun format(content: String): String {
        if (content.isBlank()) {
            return ""
        }

        val root = runCatching { yamlMapper.readTree(content) }
            .getOrElse { throw IllegalArgumentException("YAML невалиден: ${it.message}", it) }
            ?: return ""
        orderFields(root)

        return yamlMapper.writeValueAsString(root)
            .let { if (it.endsWith('\n')) it else "$it\n" }
    }

    private fun orderFields(node: JsonNode) {
        when (node) {
            is ObjectNode -> orderObjectFields(node)
            is ArrayNode -> node.forEach(::orderFields)
        }
    }

    private fun orderObjectFields(node: ObjectNode) {
        val fields = node.properties().map { it.key to it.value }
        fields.forEach { (_, value) -> orderFields(value) }

        if (fields.none { (name, _) -> name in priorityFields }) {
            return
        }

        val fieldsByName = fields.toMap()
        node.removeAll()
        priorityFields.forEach { name ->
            fieldsByName[name]?.let { value -> node.set<JsonNode>(name, value) }
        }
        fields.forEach { (name, value) ->
            if (name !in priorityFields) {
                node.set<JsonNode>(name, value)
            }
        }
    }
}
