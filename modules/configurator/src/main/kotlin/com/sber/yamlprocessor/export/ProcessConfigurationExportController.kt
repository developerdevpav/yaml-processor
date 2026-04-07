package com.sber.yamlprocessor.export

import com.sber.yamlprocessor.graphql.ProcessConfigurationExportService
import org.springframework.http.ContentDisposition
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/process-configs")
class ProcessConfigurationExportController(
    private val exportService: ProcessConfigurationExportService
) {
    @GetMapping("/{id}/export", produces = ["application/yaml"])
    fun export(
        @PathVariable id: String,
        @RequestParam(name = "type", defaultValue = "DEFAULT") type: ProcessConfigurationExportType
    ): ResponseEntity<String> {
        val exported = exportService.exportProcessConfig(id, type)
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType("application/yaml"))
            .header(
                HttpHeaders.CONTENT_DISPOSITION,
                ContentDisposition.attachment().filename(exported.filename).build().toString()
            )
            .body(exported.content)
    }
}
