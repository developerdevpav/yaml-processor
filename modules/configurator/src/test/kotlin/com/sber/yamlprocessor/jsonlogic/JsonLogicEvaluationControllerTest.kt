package com.sber.yamlprocessor.jsonlogic

import com.fasterxml.jackson.databind.node.BooleanNode
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.ArgumentMatchers
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.boot.test.mock.mockito.MockBean
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.post

@Suppress("UNCHECKED_CAST")
private fun <T> anyValue(): T = ArgumentMatchers.any<T>() as T

@WebMvcTest(JsonLogicEvaluationController::class)
class JsonLogicEvaluationControllerTest {

    @Autowired
    lateinit var mockMvc: MockMvc

    @MockBean
    lateinit var jsonLogicEvaluationService: JsonLogicEvaluationService

    @Test
    fun `evaluates json logic rule`() {
        given(jsonLogicEvaluationService.evaluate(anyValue(), anyValue())).willReturn(BooleanNode.TRUE)

        mockMvc.post("/api/json-logic/evaluate") {
            contentType = MediaType.APPLICATION_JSON
            content =
                """
                {
                  "rule": {
                    "==": [
                      { "var": "payload.type" },
                      "PAYMENT"
                    ]
                  },
                  "data": {
                    "payload": {
                      "type": "PAYMENT"
                    }
                  }
                }
                """.trimIndent()
        }.andExpect {
            status { isOk() }
            content { contentType(MediaType.APPLICATION_JSON) }
            jsonPath("$.result") { value(true) }
        }
    }
}
