package com.sber.yamlprocessor.jsonlogic

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import io.github.jamsesso.jsonlogic.JsonLogic
import org.springframework.stereotype.Service

@Service
class JsonLogicEvaluationService(
    private val objectMapper: ObjectMapper
) {
    private val jsonLogic = JsonLogic()

    fun evaluate(rule: JsonNode, data: JsonNode?): JsonNode {
        val result = jsonLogic.apply(
            objectMapper.writeValueAsString(rule),
            objectMapper.convertValue(data ?: objectMapper.createObjectNode(), Any::class.java)
        )
        return objectMapper.valueToTree(result)
    }
}
