package com.sber.yamlprocessor.importer

import jakarta.persistence.EntityManager
import com.sber.yamlprocessor.model.ParentMode
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.mock.web.MockMultipartFile
import org.springframework.transaction.annotation.Transactional

@SpringBootTest
@Transactional
class ProcessConfigurationImportServiceTest {

    @Autowired
    lateinit var importService: ProcessConfigurationImportService

    @Autowired
    lateinit var entityManager: EntityManager

    @Test
    fun `imports yaml process config in new scheme`() {
        val file = MockMultipartFile(
            "files",
            "process.yaml",
            "application/yaml",
            """
            process:
              id: process_alpha
              context-code: PSPLUS
              node_name: process_alpha
              node_comment: process comment
              subprocess:
                - id: subprocess_alpha
                  node_name: subprocess_alpha
                  node_comment: subprocess comment
                  trigger:
                    rule: trigger.rule
                  stages:
                    - id: stage_alpha
                      executor: executor.alpha
                      node_name: stage_alpha
                      node_comment: stage comment
                      configurator:
                        filter-event-rule: payload != null
                        result:
                          - input-scenarios:
                              - scenario_a
                            reverse:
                              - status: INITIATED
                                output:
                                  - phase: START
                                    name: output_a
                                    body:
                                      type: SERVICE
                                      service:
                                        scenario: scenario_a
                                    log:
                                      journal-service-name: journal-service
                                    parent:
                                      include: true
                                      mode: SURFACE
            """.trimIndent().toByteArray()
        )

        val imported = importService.import(listOf(file)).single()

        val processConfig = entityManager.find(
            com.sber.yamlprocessor.model.ProcessConfig::class.java,
            imported.processConfigId
        )

        assertNotNull(processConfig)
        assertEquals("process_alpha", processConfig.process?.nodeName)
        assertEquals("process comment", processConfig.process?.nodeComment)
        assertEquals("subprocess_alpha", processConfig.process?.subprocess?.single()?.nodeName)
        assertEquals("subprocess comment", processConfig.process?.subprocess?.single()?.nodeComment)
        assertEquals("stage_alpha", processConfig.process?.subprocess?.single()?.stages?.single()?.nodeName)
        assertEquals("stage comment", processConfig.process?.subprocess?.single()?.stages?.single()?.nodeComment)
        val output = processConfig.process?.subprocess?.single()?.stages?.single()?.configurator
            ?.result?.single()?.reverse?.single()?.output?.single()
        assertEquals(true, output?.parent?.include)
        assertEquals(ParentMode.SURFACE, output?.parent?.mode)
    }

    @Test
    fun `rejects legacy yaml process config`() {
        val file = MockMultipartFile(
            "files",
            "process.yaml",
            "application/yaml",
            """
            process:
              id: process_alpha
              description: process comment
              subprocess: []
            """.trimIndent().toByteArray()
        )

        assertThrows(IllegalArgumentException::class.java) {
            importService.import(listOf(file))
        }
    }

    @Test
    fun `compacts json logic rules on import`() {
        val expandedRule = """
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
                }
              ]
            }
        """.trimIndent()
        val file = MockMultipartFile(
            "files",
            "process.yaml",
            "application/yaml",
            """
            process:
              context-code: PSPLUS
              subprocess:
                - trigger:
                    rule: |-
${expandedRule.prependIndent("                      ")}
                  stages:
                    - executor: executor.alpha
                      configurator:
                        filter-event-rule: |-
${expandedRule.prependIndent("                          ")}
                        result:
                          - reverse:
                              - status: INITIATED
                                output:
                                  - phase: START
                                    rule: |-
${expandedRule.prependIndent("                                      ")}
                                    body:
                                      service:
                                        scenario: scenario_a
            """.trimIndent().toByteArray()
        )

        val imported = importService.import(listOf(file)).single()
        entityManager.flush()
        entityManager.clear()

        val processConfig = entityManager.find(
            com.sber.yamlprocessor.model.ProcessConfig::class.java,
            imported.processConfigId
        )
        val subprocess = processConfig.process?.subprocess?.single()
        val configurator = subprocess?.stages?.single()?.configurator
        val output = configurator?.result?.single()?.reverse?.single()?.output?.single()
        val expectedRule = """
            {
              "and": [
                {
                  "some": [
                    { "var": "events" },
                    { "==": [ { "var": "body.service.scenario" }, "DealStructuring" ] }
                  ]
                }
              ]
            }
        """.trimIndent()

        assertEquals(expectedRule, subprocess?.trigger?.rule)
        assertEquals(expectedRule, configurator?.filterEventRule)
        assertEquals(expectedRule, output?.rule)
    }

    @Test
    fun `replaces existing process config from yaml text`() {
        val file = MockMultipartFile(
            "files",
            "process.yaml",
            "application/yaml",
            """
            process:
              context-code: PSPLUS
              node_name: original_process
              subprocess:
                - node_name: original_subprocess
            """.trimIndent().toByteArray()
        )

        val imported = importService.import(listOf(file)).single()

        val replaced = importService.replaceProcessConfig(
            imported.processConfigId,
            """
            process:
              context-code: PSPLUS
              node_name: replaced_process
              node_comment: replaced comment
              subprocess: []
            """.trimIndent()
        )

        entityManager.flush()
        entityManager.clear()

        val processConfig = entityManager.find(
            com.sber.yamlprocessor.model.ProcessConfig::class.java,
            imported.processConfigId
        )

        assertEquals(imported.processConfigId, replaced.processConfigId)
        assertEquals("PSPLUS", replaced.contextCode)
        assertNotNull(processConfig)
        assertEquals("replaced_process", processConfig.process?.nodeName)
        assertEquals("replaced comment", processConfig.process?.nodeComment)
        assertEquals("PSPLUS", processConfig.process?.contextCode?.code)
        assertEquals(0, processConfig.process?.subprocess?.size)
    }

    @Test
    fun `beautifies yaml text on server`() {
        val beautified = importService.beautifyYaml("process: {context-code: PSPLUS, subprocess: [{node_name: alpha}]}\n")

        assertEquals(
            """
            process:
              context-code: PSPLUS
              subprocess:
                - node_name: alpha
            """.trimIndent() + "\n",
            beautified
        )
    }
}
