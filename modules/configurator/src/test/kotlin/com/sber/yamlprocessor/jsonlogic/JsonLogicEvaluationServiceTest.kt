package com.sber.yamlprocessor.jsonlogic

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class JsonLogicEvaluationServiceTest {

    private val objectMapper: ObjectMapper = ObjectMapper().findAndRegisterModules().registerKotlinModule()
    private val service = JsonLogicEvaluationService(objectMapper)

    @Test
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
}
