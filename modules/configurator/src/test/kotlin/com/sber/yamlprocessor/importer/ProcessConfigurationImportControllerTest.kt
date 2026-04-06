package com.sber.yamlprocessor.importer

import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.ArgumentMatchers.anyList
import org.mockito.ArgumentMatchers.eq
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.boot.test.mock.mockito.MockBean
import org.springframework.http.MediaType
import org.springframework.mock.web.MockMultipartFile
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.multipart
import java.util.UUID

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

        given(importService.import(anyList(), eq(YamlImportScheme.NEW))).willReturn(
            listOf(
                ImportedProcessConfig(
                    filename = "process.yaml",
                    processConfigId = processConfigId,
                    processId = processId,
                    contextCode = "PSPLUS"
                )
            )
        )

        mockMvc.multipart("/api/process-configs/import") {
            file(file)
            param("scheme", "NEW")
            contentType = MediaType.MULTIPART_FORM_DATA
        }.andExpect {
            status { isOk() }
            content { contentType(MediaType.APPLICATION_JSON) }
            jsonPath("$.imported[0].filename") { value("process.yaml") }
            jsonPath("$.imported[0].processConfigId") { value(processConfigId.toString()) }
            jsonPath("$.imported[0].processId") { value(processId.toString()) }
            jsonPath("$.imported[0].contextCode") { value("PSPLUS") }
        }
    }
}
