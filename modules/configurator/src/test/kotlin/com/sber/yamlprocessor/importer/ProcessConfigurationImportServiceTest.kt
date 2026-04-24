package com.sber.yamlprocessor.importer

import jakarta.persistence.EntityManager
import com.sber.yamlprocessor.model.ParentMode
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
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

        val imported = importService.import(listOf(file), YamlImportScheme.NEW).single()

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
    fun `imports yaml process config in legacy scheme and maps descriptions into node comments`() {
        val file = MockMultipartFile(
            "files",
            "process.yaml",
            "application/yaml",
            """
            process:
              id: process_alpha
              context-code: PSPLUS
              description: process comment
              subprocess:
                - id: subprocess_alpha
                  description: subprocess comment
                  trigger:
                    rule: trigger.rule
                  stages:
                    - id: stage_alpha
                      executor: executor.alpha
                      description: stage comment
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
            """.trimIndent().toByteArray()
        )

        val imported = importService.import(listOf(file), YamlImportScheme.LEGACY).single()

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
    }
}
