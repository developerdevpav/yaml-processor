package com.sber.yamlprocessor.export

import com.sber.yamlprocessor.graphql.ProcessConfigurationExport
import com.sber.yamlprocessor.graphql.ProcessConfigurationExportService
import org.hamcrest.Matchers.containsString
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.boot.test.mock.mockito.MockBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get

@WebMvcTest(ProcessConfigurationExportController::class)
class ProcessConfigurationExportControllerTest {

    @Autowired
    lateinit var mockMvc: MockMvc

    @MockBean
    lateinit var exportService: ProcessConfigurationExportService

    @Test
    fun `exports process config as yaml file`() {
        given(exportService.exportProcessConfig("config-1"))
            .willReturn(
                ProcessConfigurationExport(
                    filename = "process.yaml",
                    content = "description: test\n"
                )
            )

        mockMvc.get("/api/process-configs/config-1/export")
            .andExpect {
                status { isOk() }
                content { contentType("application/yaml") }
                header {
                    string("Content-Disposition", containsString("attachment"))
                    string("Content-Disposition", containsString("process.yaml"))
                }
                content { string("description: test\n") }
            }
    }
}
