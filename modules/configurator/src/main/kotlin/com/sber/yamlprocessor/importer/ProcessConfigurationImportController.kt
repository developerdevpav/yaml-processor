package com.sber.yamlprocessor.importer

import org.springframework.http.MediaType
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestPart
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MultipartFile
import java.util.UUID

data class ProcessConfigurationImportResponse(
    val imported: List<ImportedProcessConfig>
)

@RestController
@RequestMapping("/api/process-configs")
class ProcessConfigurationImportController(
    private val importService: ProcessConfigurationImportService
) {
    @PostMapping(
        "/import",
        consumes = [MediaType.MULTIPART_FORM_DATA_VALUE],
        produces = [MediaType.APPLICATION_JSON_VALUE]
    )
    fun importYaml(
        @RequestPart("files") files: List<MultipartFile>
    ): ProcessConfigurationImportResponse =
        ProcessConfigurationImportResponse(importService.import(files))

    @PostMapping(
        "/yaml/beautify",
        consumes = [MediaType.TEXT_PLAIN_VALUE, "application/yaml", "application/x-yaml"],
        produces = [MediaType.TEXT_PLAIN_VALUE]
    )
    fun beautifyYaml(@RequestBody content: String): String =
        importService.beautifyYaml(content)

    @PutMapping(
        "/{id}/yaml",
        consumes = [MediaType.TEXT_PLAIN_VALUE, "application/yaml", "application/x-yaml"],
        produces = [MediaType.APPLICATION_JSON_VALUE]
    )
    fun replaceYaml(
        @PathVariable id: UUID,
        @RequestBody content: String
    ): ImportedProcessConfig =
        importService.replaceProcessConfig(id, content)
}
