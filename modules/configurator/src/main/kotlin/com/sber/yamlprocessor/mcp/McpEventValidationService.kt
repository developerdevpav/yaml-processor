package com.sber.yamlprocessor.mcp

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.JsonNodeFactory
import com.sber.yamlprocessor.jsonlogic.JsonLogicEvaluationService
import com.sber.yamlprocessor.model.ProcessConfig
import jakarta.persistence.EntityManager
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID
import java.util.regex.Pattern

@Service
class McpEventValidationService(
    private val entityManager: EntityManager,
    private val objectMapper: ObjectMapper,
    private val jsonLogicEvaluationService: JsonLogicEvaluationService
) {
    @Transactional(readOnly = true)
    fun validate(arguments: Map<String, Any?>): Map<String, Any?> {
        val event = objectMapper.valueToTree<JsonNode>(
            arguments["event"] ?: throw IllegalArgumentException("validateEvent requires event")
        )
        val processConfigId = arguments["processConfigId"]?.toString()?.takeIf { it.isNotBlank() }?.let(UUID::fromString)
        val includeNonMatches = arguments["includeNonMatches"] as? Boolean ?: false
        val configs = processConfigs(processConfigId)
        val scenario = scenarioFrom(event)

        val results = configs.mapNotNull { config ->
            val process = config.process ?: return@mapNotNull null
            val subprocesses = process.subprocess.mapNotNull { subprocess ->
                val trigger = evaluateRule(subprocess.trigger.rule, event)
                val stages = subprocess.stages.mapNotNull { stage ->
                    val configurator = stage.configurator ?: return@mapNotNull null
                    val filter = evaluateRule(configurator.filterEventRule, event)
                    val resultMatches = configurator.result.mapNotNull { result ->
                        val scenarioMatch = scenarioMatches(scenario, result.inputScenarios)
                        val reverses = result.reverse.mapNotNull { reverse ->
                            val outputs = reverse.output.mapNotNull { output ->
                                val outputRule = evaluateRule(output.rule, event)
                                val matched = matched(trigger) && matched(filter) && scenarioMatch && matched(outputRule)
                                if (!matched && !includeNonMatches) {
                                    return@mapNotNull null
                                }
                                mapOf(
                                    "id" to output.id,
                                    "name" to output.name,
                                    "phase" to output.phase.code,
                                    "matched" to matched,
                                    "rule" to outputRule,
                                    "parent" to mapOf(
                                        "include" to output.parent?.include,
                                        "mode" to output.parent?.mode?.name
                                    ),
                                    "body" to mapOf(
                                        "type" to output.body.type,
                                        "serviceScenario" to output.body.service?.scenario,
                                        "serviceType" to output.body.service?.type,
                                        "eventObjectType" to output.body.eventObject?.type
                                    )
                                )
                            }
                            if (outputs.isEmpty() && !includeNonMatches) {
                                return@mapNotNull null
                            }
                            mapOf(
                                "id" to reverse.id,
                                "status" to reverse.status.code,
                                "outputs" to outputs
                            )
                        }
                        val matched = matched(trigger) && matched(filter) && scenarioMatch && reverses.any { reverse ->
                            @Suppress("UNCHECKED_CAST")
                            (reverse["outputs"] as List<Map<String, Any?>>).any { it["matched"] == true }
                        }
                        if (!matched && !includeNonMatches) {
                            return@mapNotNull null
                        }
                        mapOf(
                            "id" to result.id,
                            "inputScenarios" to result.inputScenarios,
                            "scenarioMatched" to scenarioMatch,
                            "matched" to matched,
                            "reverse" to reverses
                        )
                    }
                    val matched = matched(trigger) && matched(filter) && resultMatches.any { it["matched"] == true }
                    if (!matched && !includeNonMatches) {
                        return@mapNotNull null
                    }
                    mapOf(
                        "id" to stage.id,
                        "nodeName" to stage.nodeName,
                        "executor" to stage.executor,
                        "filterEventRule" to filter,
                        "matched" to matched,
                        "results" to resultMatches
                    )
                }
                val matched = matched(trigger) && stages.any { it["matched"] == true }
                if (!matched && !includeNonMatches) {
                    return@mapNotNull null
                }
                mapOf(
                    "id" to subprocess.id,
                    "nodeName" to subprocess.nodeName,
                    "disabled" to subprocess.disabled,
                    "trigger" to trigger,
                    "matched" to matched,
                    "stages" to stages
                )
            }
            val matched = !process.disabled && subprocesses.any { it["matched"] == true }
            if (!matched && !includeNonMatches) {
                return@mapNotNull null
            }
            mapOf(
                "id" to config.id,
                "process" to mapOf(
                    "id" to process.id,
                    "nodeName" to process.nodeName,
                    "disabled" to process.disabled,
                    "contextCode" to process.contextCode?.code,
                    "matched" to matched,
                    "subprocess" to subprocesses
                )
            )
        }

        return mapOf(
            "scenario" to scenario,
            "matched" to results.any { ((it["process"] as Map<*, *>)["matched"] == true) },
            "processConfigs" to results
        )
    }

    private fun processConfigs(processConfigId: UUID?): List<ProcessConfig> =
        if (processConfigId == null) {
            entityManager.createQuery("select pc from ProcessConfig pc", ProcessConfig::class.java).resultList
        } else {
            listOfNotNull(entityManager.find(ProcessConfig::class.java, processConfigId))
        }

    private fun evaluateRule(ruleText: String?, event: JsonNode): Map<String, Any?> {
        val normalized = ruleText?.trim().orEmpty()
        if (normalized.isBlank()) {
            return mapOf("matched" to true, "result" to true, "empty" to true)
        }

        return try {
            val rule = objectMapper.readTree(normalized)
            val result = jsonLogicEvaluationService.evaluate(rule, event)
            mapOf("matched" to truthy(result), "result" to result)
        } catch (exception: Exception) {
            mapOf("matched" to false, "error" to (exception.message ?: exception::class.java.simpleName))
        }
    }

    private fun matched(result: Map<String, Any?>): Boolean =
        result["matched"] == true

    private fun scenarioFrom(event: JsonNode): String? =
        listOf(
            "/b3event/body/service/scenario",
            "/body/service/scenario",
            "/payload/b3event/body/service/scenario",
            "/payload/body/service/scenario",
            "/payload/service/scenario"
        )
            .map { event.at(it) }
            .firstOrNull { !it.isMissingNode && !it.isNull && it.asText().isNotBlank() }
            ?.asText()

    private fun scenarioMatches(scenario: String?, patterns: List<String>): Boolean {
        if (scenario.isNullOrBlank()) {
            return false
        }
        return patterns.any { pattern ->
            val normalized = pattern.trim()
            normalized.isNotEmpty() && Regex(globToRegex(normalized)).matches(scenario)
        }
    }

    private fun globToRegex(pattern: String): String =
        buildString {
            pattern.forEach { char ->
                when (char) {
                    '*' -> append(".*")
                    '?' -> append(".")
                    else -> append(Pattern.quote(char.toString()))
                }
            }
        }

    private fun truthy(node: JsonNode?): Boolean = when {
        node == null || node.isMissingNode || node.isNull -> false
        node.isBoolean -> node.asBoolean()
        node.isNumber -> node.asDouble() != 0.0
        node.isTextual -> node.asText().isNotBlank()
        node.isArray -> node.size() > 0
        node.isObject -> node != JsonNodeFactory.instance.objectNode()
        else -> false
    }
}
