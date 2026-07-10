package com.sber.yamlprocessor.jsonlogic

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class JsonLogicFormattingServiceTest {

    private val service = JsonLogicFormattingService(
        ObjectMapper().findAndRegisterModules().registerKotlinModule()
    )

    @Test
    fun `formats json logic rules compactly`() {
        val source = """
            {
              "and": [
                {
                  "some": [
                    {
                      "var": "events"
                    },
                    {
                      "==": [
                        {
                          "var": "body.service.scenario"
                        },
                        "DealStructuring"
                      ]
                    }
                  ]
                },
                {
                  "some": [
                    {
                      "var": "events"
                    },
                    {
                      "==": [
                        {
                          "var": "body.service.scenario"
                        },
                        "DealStructuringTwo"
                      ]
                    }
                  ]
                }
              ]
            }
        """.trimIndent()

        assertEquals(
            """
                {
                  "and": [
                    {
                      "some": [
                        { "var": "events" },
                        { "==": [ { "var": "body.service.scenario" }, "DealStructuring" ] }
                      ]
                    },
                    {
                      "some": [
                        { "var": "events" },
                        { "==": [ { "var": "body.service.scenario" }, "DealStructuringTwo" ] }
                      ]
                    }
                  ]
                }
            """.trimIndent(),
            service.format(source)
        )
    }

    @Test
    fun `keeps non json rules unchanged`() {
        assertEquals(
            "payload != null\npayload.type == 'A'",
            service.format("payload != null\npayload.type == 'A'")
        )
    }
}
