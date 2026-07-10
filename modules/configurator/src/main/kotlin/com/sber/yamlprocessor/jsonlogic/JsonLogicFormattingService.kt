package com.sber.yamlprocessor.jsonlogic

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ArrayNode
import com.fasterxml.jackson.databind.node.ObjectNode
import org.springframework.stereotype.Service

@Service
class JsonLogicFormattingService(
    private val objectMapper: ObjectMapper
) {
    private val inlineMaxLength = 90

    fun format(text: String?): String {
        val normalized = text?.trim().orEmpty()
        if (normalized.isEmpty()) {
            return ""
        }

        val node = runCatching { objectMapper.readTree(normalized) }.getOrNull() ?: return text.orEmpty()
        return formatNode(node)
    }

    private fun formatNode(node: JsonNode, level: Int = 0): String {
        if (!node.isObject && !node.isArray) {
            return objectMapper.writeValueAsString(node)
        }

        if (node is ArrayNode) {
            if (node.isEmpty) {
                return "[]"
            }

            val inline = formatInline(node)
            if (level > 0 && inline.length <= inlineMaxLength) {
                return inline
            }

            val indent = indent(level)
            val nextIndent = indent(level + 1)
            return node.joinToString(
                separator = ",\n",
                prefix = "[\n",
                postfix = "\n$indent]"
            ) { item -> "$nextIndent${formatNode(item, level + 1)}" }
        }

        node as ObjectNode
        val fields = node.fields().asSequence().toList()
        if (fields.isEmpty()) {
            return "{}"
        }

        val inline = formatInline(node)
        if (level > 0 && inline.length <= inlineMaxLength) {
            return inline
        }

        val indent = indent(level)
        val nextIndent = indent(level + 1)
        return fields.joinToString(
            separator = ",\n",
            prefix = "{\n",
            postfix = "\n$indent}"
        ) { (name, value) -> "$nextIndent${objectMapper.writeValueAsString(name)}: ${formatNode(value, level + 1)}" }
    }

    private fun formatInline(node: JsonNode): String =
        when {
            !node.isObject && !node.isArray -> objectMapper.writeValueAsString(node)
            node is ArrayNode -> node.joinToString(prefix = "[ ", postfix = " ]") { formatInline(it) }
            node is ObjectNode -> node.fields().asSequence().joinToString(prefix = "{ ", postfix = " }") { (name, value) ->
                "${objectMapper.writeValueAsString(name)}: ${formatInline(value)}"
            }
            else -> objectMapper.writeValueAsString(node)
        }

    private fun indent(level: Int): String = "  ".repeat(level)
}
