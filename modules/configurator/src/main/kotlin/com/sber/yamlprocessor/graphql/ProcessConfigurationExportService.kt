package com.sber.yamlprocessor.graphql

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ArrayNode
import com.fasterxml.jackson.databind.node.ObjectNode
import com.fasterxml.jackson.dataformat.yaml.YAMLMapper
import com.sber.yamlprocessor.model.Process
import com.sber.yamlprocessor.yaml.YamlFormattingService
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.yaml.snakeyaml.DumperOptions
import org.yaml.snakeyaml.Yaml
import org.yaml.snakeyaml.nodes.Node
import org.yaml.snakeyaml.nodes.Tag
import org.yaml.snakeyaml.representer.Represent
import org.yaml.snakeyaml.representer.Representer
import java.text.Normalizer
import java.util.LinkedHashMap

data class ProcessConfigurationExport(
    val filename: String,
    val content: String
)

@Service
class ProcessConfigurationExportService(
    private val crudService: JpaGraphQlCrudService,
    private val objectMapper: ObjectMapper,
    private val yamlFormattingService: YamlFormattingService
) {
    private val yamlMapper = YAMLMapper()
    private val yaml = Yaml(FilterEventRuleRepresenter(), DumperOptions().apply {
        defaultFlowStyle = DumperOptions.FlowStyle.BLOCK
        isPrettyFlow = true
        indent = 2
        indicatorIndent = 1
        defaultScalarStyle = DumperOptions.ScalarStyle.PLAIN
    })

    @Transactional(readOnly = true)
    fun exportProcessConfig(id: Any?): ProcessConfigurationExport {
        val processConfig = crudService.findProcessConfigForExport(id)
        val process = processConfig.process ?: error("ProcessConfig ${processConfig.id} does not contain process")
        val yamlTree = objectMapper.valueToTree<ObjectNode>(process).deepCopy()
        stripTechnicalFields(yamlTree)

        return ProcessConfigurationExport(
            filename = buildFilename(process),
            content = yamlFormattingService.format(yaml.dump(asYamlValue(yamlTree)))
        )
    }

    private fun stripTechnicalFields(node: com.fasterxml.jackson.databind.JsonNode?) {
        when (node) {
            is ObjectNode -> {
                node.remove(listOf("createdAt", "updatedAt", "created_at", "updated_at"))
                val fields = node.fields()
                while (fields.hasNext()) {
                    stripTechnicalFields(fields.next().value)
                }
            }
            is ArrayNode -> {
                node.forEach(::stripTechnicalFields)
            }
        }
    }

    private fun buildFilename(process: Process): String {
        val rawName = process.contextCode?.code
            ?: process.nodeNameOrDescription()
            ?: process.id?.toString()
            ?: "process"
        val normalized = Normalizer.normalize(rawName, Normalizer.Form.NFKC)
            .replace(Regex("[^A-Za-z0-9._-]+"), "-")
            .trim('-')
            .ifBlank { "process" }
        return "$normalized.yaml"
    }

    private fun Process.nodeNameOrDescription(): String? =
        nodeName
            ?.trim()
            ?.takeIf { it.isNotEmpty() }
            ?: nodeComment
                ?.trim()
                ?.takeIf { it.isNotEmpty() }

    private fun asYamlValue(
        node: com.fasterxml.jackson.databind.JsonNode?,
        fieldName: String? = null,
        parentPath: List<String> = emptyList()
    ): Any? =
        when {
            node == null || node.isNull -> null
            node.isObject -> LinkedHashMap<String, Any?>().also { map ->
                node.fields().forEachRemaining { (name, value) ->
                    val yamlValue = asYamlValue(value, name, parentPath + name)
                    if (yamlValue != null || shouldExportExplicitNull(value)) {
                        map[name] = yamlValue
                    }
                }
            }
            node.isArray -> node.map { asYamlValue(it, fieldName, parentPath) }
            node.isTextual -> {
                val text = node.textValue()
                if (text.trim().isEmpty()) {
                    null
                } else if (requiresLiteralStyle(fieldName, parentPath)) {
                    LiteralString(text)
                } else {
                    text
                }
            }
            node.isBoolean -> node.booleanValue()
            node.isIntegralNumber -> node.longValue()
            node.isFloatingPointNumber -> node.doubleValue()
            else -> yamlMapper.treeToValue(node, Any::class.java)
        }

    private fun requiresLiteralStyle(fieldName: String?, path: List<String>): Boolean =
        fieldName == "filter-event-rule" ||
            path.takeLast(2) == listOf("trigger", "rule") ||
            path.takeLast(2) == listOf("output", "rule")

    private fun shouldExportExplicitNull(node: com.fasterxml.jackson.databind.JsonNode?): Boolean =
        false
}

private data class LiteralString(val value: String)

private class FilterEventRuleRepresenter : Representer(DumperOptions()) {
    init {
        representers[LiteralString::class.java] = LiteralStringRepresent()
    }

    private inner class LiteralStringRepresent : Represent {
        override fun representData(data: Any): Node =
            representScalar(Tag.STR, (data as LiteralString).value, DumperOptions.ScalarStyle.LITERAL)
    }
}
