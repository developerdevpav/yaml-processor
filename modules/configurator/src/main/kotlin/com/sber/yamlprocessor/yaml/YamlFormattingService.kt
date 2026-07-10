package com.sber.yamlprocessor.yaml

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.SerializationFeature
import com.fasterxml.jackson.databind.node.ArrayNode
import com.fasterxml.jackson.databind.node.ObjectNode
import com.fasterxml.jackson.dataformat.yaml.YAMLGenerator
import com.fasterxml.jackson.dataformat.yaml.YAMLMapper
import org.yaml.snakeyaml.DumperOptions
import org.yaml.snakeyaml.Yaml
import org.yaml.snakeyaml.nodes.Node
import org.yaml.snakeyaml.nodes.Tag
import org.yaml.snakeyaml.representer.Represent
import org.yaml.snakeyaml.representer.Representer
import org.springframework.stereotype.Service
import java.util.LinkedHashMap

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

    private val yaml = Yaml(RuleLiteralRepresenter(), DumperOptions().apply {
        defaultFlowStyle = DumperOptions.FlowStyle.BLOCK
        isPrettyFlow = false
        indent = 2
        indicatorIndent = 2
        indentWithIndicator = true
        defaultScalarStyle = DumperOptions.ScalarStyle.PLAIN
    })

    fun format(content: String): String {
        if (content.isBlank()) {
            return ""
        }

        val root = runCatching { yamlMapper.readTree(content) }
            .getOrElse { throw IllegalArgumentException("YAML невалиден: ${it.message}", it) }
            ?: return ""
        orderFields(root)

        return yaml.dump(asYamlValue(root))
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

    private fun asYamlValue(
        node: JsonNode,
        fieldName: String? = null,
        path: List<String> = emptyList()
    ): Any? =
        when {
            node.isNull -> null
            node.isObject -> LinkedHashMap<String, Any?>().also { map ->
                node.properties().forEach { (name, value) ->
                    map[name] = asYamlValue(value, name, path + name)
                }
            }
            node.isArray -> node.map { asYamlValue(it, fieldName, path) }
            node.isTextual -> {
                val text = node.textValue()
                if (requiresRuleLiteralStyle(fieldName, path)) {
                    RuleLiteralString(text)
                } else {
                    text
                }
            }
            node.isBoolean -> node.booleanValue()
            node.isIntegralNumber -> node.longValue()
            node.isFloatingPointNumber -> node.doubleValue()
            else -> yamlMapper.treeToValue(node, Any::class.java)
        }

    private fun requiresRuleLiteralStyle(fieldName: String?, path: List<String>): Boolean =
        fieldName == "filter-event-rule" ||
            path.takeLast(2) == listOf("trigger", "rule") ||
            path.takeLast(2) == listOf("output", "rule")
}

private data class RuleLiteralString(val value: String)

private class RuleLiteralRepresenter : Representer(DumperOptions()) {
    init {
        representers[RuleLiteralString::class.java] = RuleLiteralStringRepresent()
    }

    private inner class RuleLiteralStringRepresent : Represent {
        override fun representData(data: Any): Node =
            representScalar(Tag.STR, (data as RuleLiteralString).value, DumperOptions.ScalarStyle.LITERAL)
    }
}
