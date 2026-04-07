package com.sber.yamlprocessor.jsonlogic

import com.fasterxml.jackson.annotation.JsonProperty
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.node.JsonNodeFactory
import io.github.jamsesso.jsonlogic.ast.JsonLogicParseException
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException

@RestController
@RequestMapping("/api/json-logic")
class JsonLogicEvaluationController(
    private val jsonLogicEvaluationService: JsonLogicEvaluationService
) {

    @PostMapping("/evaluate")
    fun evaluate(@RequestBody request: JsonLogicEvaluationRequest): JsonLogicEvaluationResponse =
        try {
            val rule = request.rule
                ?: throw IllegalArgumentException("Поле rule обязательно и должно содержать JsonLogic правило.")
            JsonLogicEvaluationResponse(
                result = jsonLogicEvaluationService.evaluate(rule, request.data ?: JsonNodeFactory.instance.objectNode())
            )
        } catch (exception: JsonLogicParseException) {
            throw ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Невалидное JsonLogic правило.",
                exception
            )
        } catch (exception: IllegalArgumentException) {
            throw ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                exception.message ?: "Не удалось выполнить JsonLogic правило.",
                exception
            )
        } catch (exception: Exception) {
            throw ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Не удалось вычислить JsonLogic правило.",
                exception
            )
        }
}

data class JsonLogicEvaluationRequest(
    @field:JsonProperty("rule")
    val rule: JsonNode? = null,
    @field:JsonProperty("data")
    val data: JsonNode? = null
)

data class JsonLogicEvaluationResponse(
    @field:JsonProperty("result")
    val result: JsonNode
)
