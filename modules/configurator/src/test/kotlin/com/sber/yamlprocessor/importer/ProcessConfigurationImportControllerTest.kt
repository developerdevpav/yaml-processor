package com.sber.yamlprocessor.importer

import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.ArgumentMatchers
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.boot.test.mock.mockito.MockBean
import org.springframework.http.MediaType
import org.springframework.mock.web.MockMultipartFile
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.multipart
import org.springframework.test.web.servlet.post
import org.springframework.test.web.servlet.put
import java.util.UUID

@Suppress("UNCHECKED_CAST")
private fun <T> eq(value: T): T = ArgumentMatchers.eq(value) ?: value

@WebMvcTest(ProcessConfigurationImportController::class)
class ProcessConfigurationImportControllerTest {

    @Autowired
    lateinit var mockMvc: MockMvc

    @MockBean
    lateinit var importService: ProcessConfigurationImportService

    @Test
    fun `imports yaml files`() {
        val processConfigId = UUID.fromString("11111111-1111-1111-1111-111111111111")
        val processId = UUID.fromString("22222222-2222-2222-2222-222222222222")
        val file = MockMultipartFile("files", "process.yaml", "application/yaml", "process: {}\n".toByteArray())

        given(importService.importFile(eq(file))).willReturn(
            ImportedProcessConfig(
                filename = "process.yaml",
                processConfigId = processConfigId,
                processId = processId,
                contextCode = "PSPLUS"
            )
        )

        mockMvc.multipart("/api/process-configs/import") {
            file(file)
            contentType = MediaType.MULTIPART_FORM_DATA
        }.andExpect {
            status { isOk() }
            content { contentType(MediaType.APPLICATION_JSON) }
            jsonPath("$.imported[0].filename") { value("process.yaml") }
            jsonPath("$.imported[0].process_config_id") { value(processConfigId.toString()) }
            jsonPath("$.imported[0].process_id") { value(processId.toString()) }
            jsonPath("$.imported[0].context_code") { value("PSPLUS") }
            jsonPath("$.failed.length()") { value(0) }
        }
    }

    @Test
    fun `replaces process config from yaml text`() {
        val processConfigId = UUID.fromString("11111111-1111-1111-1111-111111111111")
        val processId = UUID.fromString("22222222-2222-2222-2222-222222222222")
        val yaml = "process:\n  context-code: PSPLUS\n"

        given(importService.replaceProcessConfig(eq(processConfigId), eq(yaml))).willReturn(
            ImportedProcessConfig(
                filename = "process.yaml",
                processConfigId = processConfigId,
                processId = processId,
                contextCode = "PSPLUS"
            )
        )

        mockMvc.put("/api/process-configs/$processConfigId/yaml") {
            content = yaml
            contentType = MediaType.TEXT_PLAIN
        }.andExpect {
            status { isOk() }
            content { contentType(MediaType.APPLICATION_JSON) }
            jsonPath("$.filename") { value("process.yaml") }
            jsonPath("$.process_config_id") { value(processConfigId.toString()) }
            jsonPath("$.process_id") { value(processId.toString()) }
            jsonPath("$.context_code") { value("PSPLUS") }
        }
    }

    @Test
    fun `returns failed yaml file without failing whole import`() {
        val processConfigId = UUID.fromString("11111111-1111-1111-1111-111111111111")
        val processId = UUID.fromString("22222222-2222-2222-2222-222222222222")
        val validFile = MockMultipartFile("files", "valid.yaml", "application/yaml", "process: {}\n".toByteArray())
        val invalidFile = MockMultipartFile("files", "invalid.yaml", "application/yaml", "process: [\n".toByteArray())

        given(importService.importFile(validFile)).willReturn(
            ImportedProcessConfig(
                filename = "valid.yaml",
                processConfigId = processConfigId,
                processId = processId,
                contextCode = "PSPLUS"
            )
        )
        given(importService.importFile(invalidFile)).willThrow(IllegalArgumentException("YAML сломан"))

        mockMvc.multipart("/api/process-configs/import") {
            file(validFile)
            file(invalidFile)
            contentType = MediaType.MULTIPART_FORM_DATA
        }.andExpect {
            status { isOk() }
            content { contentType(MediaType.APPLICATION_JSON) }
            jsonPath("$.imported[0].filename") { value("valid.yaml") }
            jsonPath("$.failed[0].filename") { value("invalid.yaml") }
            jsonPath("$.failed[0].error") { value("YAML сломан") }
        }
    }

    @Test
    fun `beautifies yaml text`() {
        val yaml = "process: {context-code: PSPLUS, subprocess: []}\n"
        val beautifiedYaml = """
            process:
              context-code: PSPLUS
              subprocess: []
        """.trimIndent() + "\n"

        given(importService.beautifyYaml(eq(yaml))).willReturn(beautifiedYaml)

        mockMvc.post("/api/process-configs/yaml/beautify") {
            content = yaml
            contentType = MediaType.TEXT_PLAIN
        }.andExpect {
            status { isOk() }
            content { contentTypeCompatibleWith(MediaType.TEXT_PLAIN) }
            content { string(beautifiedYaml) }
        }
    }
}
