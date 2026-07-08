package com.sber.yamlprocessor.jsonlogic

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import io.github.jamsesso.jsonlogic.evaluator.JsonLogicEvaluationException
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test

@DisplayName("Вычисление JsonLogic правил")
class JsonLogicEvaluationServiceTest {

    private val objectMapper: ObjectMapper = ObjectMapper().findAndRegisterModules().registerKotlinModule()
    private val service = JsonLogicEvaluationService(objectMapper)

    @Test
    @DisplayName("Вычисляет правило с var и сравнением")
    fun `evaluates rule with var and comparison`() {
        val rule = objectMapper.readTree(
            """
            {
              "and": [
                {">": [{"var": "payload.amount"}, 100]},
                {"==": [{"var": "payload.type"}, "PAYMENT"]}
              ]
            }
            """.trimIndent()
        )
        val data = objectMapper.readTree(
            """
            {
              "payload": {
                "amount": 150,
                "type": "PAYMENT"
              }
            }
            """.trimIndent()
        )

        val result = service.evaluate(rule, data)

        assertEquals(true, result.booleanValue())
    }

    @Test
    @DisplayName("Вычисляет оператор map по массиву")
    fun `evaluates map operator over array`() {
        val rule = objectMapper.readTree(
            """
            {
              "map": [
                {"var": "items"},
                {"+": [{"var": "price"}, 10]}
              ]
            }
            """.trimIndent()
        )
        val data = objectMapper.readTree(
            """
            {
              "items": [
                {"price": 5},
                {"price": 15}
              ]
            }
            """.trimIndent()
        )

        val result = service.evaluate(rule, data)

        assertEquals("[15.0,25.0]", result.toString())
    }

    @Test
    @DisplayName("Возвращает true, когда значение совпадает с одним из regexp шаблонов")
    fun `evaluates regexp operator with any matching pattern`() {
        val rule = objectMapper.readTree(
            """
            {
              "regexp": [
                {"var": "body.service.scenario"},
                "^C7M:.*",
                "^FACTORING:.*"
              ]
            }
            """.trimIndent()
        )
        val data = objectMapper.readTree(
            """
            {
              "body": {
                "service": {
                  "scenario": "FACTORING:CREATE"
                }
              }
            }
            """.trimIndent()
        )

        val result = service.evaluate(rule, data)

        assertEquals(true, result.booleanValue())
    }

    @Test
    @DisplayName("Возвращает false, когда значение не совпадает ни с одним regexp шаблоном")
    fun `evaluates regexp operator with no matching patterns`() {
        val rule = objectMapper.readTree(
            """
            {
              "regexp": [
                {"var": "body.service.scenario"},
                "^C7M:.*",
                "^FACTORING:.*"
              ]
            }
            """.trimIndent()
        )
        val data = objectMapper.readTree(
            """
            {
              "body": {
                "service": {
                  "scenario": "PAYMENT:CREATE"
                }
              }
            }
            """.trimIndent()
        )

        val result = service.evaluate(rule, data)

        assertEquals(false, result.booleanValue())
    }

    @Test
    @DisplayName("Выбрасывает ошибку для невалидного regexp шаблона")
    fun `throws error for invalid regexp pattern`() {
        val rule = objectMapper.readTree(
            """
            {
              "regexp": [
                {"var": "body.service.scenario"},
                "["
              ]
            }
            """.trimIndent()
        )
        val data = objectMapper.readTree(
            """
            {
              "body": {
                "service": {
                  "scenario": "C7M:CREATE"
                }
              }
            }
            """.trimIndent()
        )

        assertThrows(JsonLogicEvaluationException::class.java) {
            service.evaluate(rule, data)
        }
    }
}
