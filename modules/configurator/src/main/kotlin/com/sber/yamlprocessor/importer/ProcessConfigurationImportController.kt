package com.sber.yamlprocessor.importer

import org.springframework.http.MediaType
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestPart
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MultipartFile

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
        @RequestPart("files") files: List<MultipartFile>,
        @RequestParam(name = "scheme", defaultValue = "NEW") scheme: YamlImportScheme
    ): ProcessConfigurationImportResponse =
        ProcessConfigurationImportResponse(importService.import(files, scheme))
}
