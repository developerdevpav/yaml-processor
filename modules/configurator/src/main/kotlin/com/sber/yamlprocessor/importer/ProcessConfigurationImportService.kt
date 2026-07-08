package com.sber.yamlprocessor.importer

import com.fasterxml.jackson.annotation.JsonAlias
import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.annotation.JsonProperty
import com.fasterxml.jackson.databind.DeserializationFeature
import com.fasterxml.jackson.databind.SerializationFeature
import com.fasterxml.jackson.dataformat.yaml.YAMLMapper
import com.fasterxml.jackson.dataformat.yaml.YAMLGenerator
import com.sber.yamlprocessor.model.ActionPhasesDictionary
import com.sber.yamlprocessor.model.Audit
import com.sber.yamlprocessor.model.B3StatusDictionary
import com.sber.yamlprocessor.model.Body
import com.sber.yamlprocessor.model.Configurator
import com.sber.yamlprocessor.model.ContextCodesDictionary
import com.sber.yamlprocessor.model.EventLog
import com.sber.yamlprocessor.model.EventObject
import com.sber.yamlprocessor.model.Log
import com.sber.yamlprocessor.model.Parent
import com.sber.yamlprocessor.model.ParentMode
import com.sber.yamlprocessor.model.Process
import com.sber.yamlprocessor.model.ProcessConfig
import com.sber.yamlprocessor.model.Result
import com.sber.yamlprocessor.model.Reverse
import com.sber.yamlprocessor.model.ReverseOutput
import com.sber.yamlprocessor.model.Service as ServiceBody
import com.sber.yamlprocessor.model.SlaDurationUnitDictionary
import com.sber.yamlprocessor.model.SlaState
import com.sber.yamlprocessor.model.SlaStatusDictionary
import com.sber.yamlprocessor.model.Stage
import com.sber.yamlprocessor.model.Subprocess
import com.sber.yamlprocessor.model.Trigger
import jakarta.persistence.EntityManager
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.multipart.MultipartFile
import java.io.InputStream
import java.util.UUID

data class ImportedProcessConfig(
    val filename: String,
    val processConfigId: UUID,
    val processId: UUID?,
    val contextCode: String?
)

@Service
class ProcessConfigurationImportService(
    private val entityManager: EntityManager
) {
    private val yamlMapper = YAMLMapper.builder()
        .findAndAddModules()
        .enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
        .build()

    private val beautifyYamlMapper = YAMLMapper.builder()
        .findAndAddModules()
        .disable(YAMLGenerator.Feature.WRITE_DOC_START_MARKER)
        .enable(YAMLGenerator.Feature.MINIMIZE_QUOTES)
        .enable(YAMLGenerator.Feature.INDENT_ARRAYS_WITH_INDICATOR)
        .enable(SerializationFeature.INDENT_OUTPUT)
        .build()

    @Transactional
    fun import(files: List<MultipartFile>): List<ImportedProcessConfig> {
        require(files.isNotEmpty()) { "Не выбраны YAML-файлы для импорта." }

        return files.map { file ->
            val filename = file.originalFilename?.ifBlank { file.name } ?: file.name
            require(!file.isEmpty) {
                "Файл $filename пуст."
            }
            val processDefinition = parse(file.inputStream, filename)
            val processConfig = ProcessConfig()
            val process = processDefinition.toEntity(processConfig)
            processConfig.process = process
            entityManager.persist(processConfig)
            entityManager.flush()

            ImportedProcessConfig(
                filename = filename,
                processConfigId = processConfig.id ?: error("Imported ProcessConfig id was not generated"),
                processId = process.id,
                contextCode = process.contextCode?.code
            )
        }
    }

    @Transactional
    fun replaceProcessConfig(
        processConfigId: UUID,
        content: String
    ): ImportedProcessConfig {
        require(content.isNotBlank()) { "YAML-конфигурация пуста." }

        val processConfig = entityManager.find(ProcessConfig::class.java, processConfigId)
            ?: error("ProcessConfig with id=$processConfigId not found")
        val processDefinition = parse(content.byteInputStream(), "process.yaml")

        processConfig.process?.let { currentProcess ->
            processConfig.process = null
            currentProcess.processConfig = null
            entityManager.remove(currentProcess)
            entityManager.flush()
        }

        val process = processDefinition.toEntity(processConfig)
        processConfig.process = process
        entityManager.persist(process)
        entityManager.flush()

        return ImportedProcessConfig(
            filename = "process.yaml",
            processConfigId = processConfig.id ?: error("Updated ProcessConfig id is missing"),
            processId = process.id,
            contextCode = process.contextCode?.code
        )
    }

    fun beautifyYaml(content: String): String {
        if (content.isBlank()) {
            return ""
        }

        val root = runCatching { beautifyYamlMapper.readTree(content) }
            .getOrElse { throw IllegalArgumentException("YAML невалиден: ${it.message}", it) }
            ?: return ""

        return beautifyYamlMapper.writeValueAsString(root)
            .let { if (it.endsWith('\n')) it else "$it\n" }
    }

    private fun parse(inputStream: InputStream, filename: String): ImportedProcessDefinition {
        val root = runCatching { yamlMapper.readTree(inputStream) }
            .getOrElse { throw IllegalArgumentException("Не удалось прочитать YAML $filename: ${it.message}", it) }

        require(root != null && root.isObject) {
            "Файл $filename должен содержать YAML-объект верхнего уровня."
        }

        val processNode = if (root.has("process")) root.get("process") else root
        return runCatching { yamlMapper.treeToValue(processNode, ImportedProcessDefinition::class.java) }
            .getOrElse {
                throw IllegalArgumentException(
                    "Файл $filename не соответствует ожидаемой схеме процесса: ${it.message}",
                    it
                )
            }
    }

    private fun ImportedProcessDefinition.toEntity(processConfig: ProcessConfig): Process {
        val process = Process(
            processConfig = processConfig,
            contextCode = contextCode.refOrNull(ContextCodesDictionary::class.java),
            disabled = disabled,
            nodeName = nodeName.normalizedOrNull(),
            nodeComment = nodeComment.normalizedOrNull()
        )
        process.subprocess = subprocess.map { it.toEntity(process) }.toMutableList()
        return process
    }

    private fun ImportedSubprocessDefinition.toEntity(process: Process): Subprocess {
        val subprocessEntity = Subprocess(
            process = process,
            nodeName = nodeName.normalizedOrNull(),
            nodeComment = nodeComment.normalizedOrNull(),
            disabled = disabled,
            trigger = Trigger(rule = trigger.rule.orEmpty())
        )
        subprocessEntity.stages = stages.map { it.toEntity(subprocessEntity) }.toMutableList()
        return subprocessEntity
    }

    private fun ImportedStageDefinition.toEntity(subprocess: Subprocess): Stage {
        val stage = Stage(
            subprocess = subprocess,
            executor = executor.orEmpty(),
            contextCode = contextCode.refOrNull(ContextCodesDictionary::class.java),
            log = log?.toEntity(),
            nodeName = nodeName.normalizedOrNull(),
            nodeComment = nodeComment.normalizedOrNull(),
            configurator = null
        )
        val configuratorEntity = configurator.toEntity(stage)
        stage.configurator = configuratorEntity
        return stage
    }

    private fun ImportedConfiguratorDefinition.toEntity(stage: Stage): Configurator {
        val configuratorEntity = Configurator(
            stage = stage,
            disabled = disabled,
            interrupted = interrupted,
            multiple = multiple,
            audit = audit?.toEntity(),
            filterEventRule = filterEventRule.orEmpty()
        )
        configuratorEntity.result = result.map { it.toEntity(configuratorEntity) }.toMutableList()
        return configuratorEntity
    }

    private fun ImportedResultDefinition.toEntity(configurator: Configurator): Result {
        val resultEntity = Result(
            configurator = configurator,
            inputScenarios = inputScenarios.mapNotNull { it.normalizedOrNull() }.toMutableList()
        )
        resultEntity.reverse = reverse.map { it.toEntity(resultEntity) }.toMutableList()
        return resultEntity
    }

    private fun ImportedReverseDefinition.toEntity(result: Result): Reverse =
        Reverse(
            result = result,
            status = entityManager.getReference(B3StatusDictionary::class.java, status.orEmpty()),
            output = output.map { it.toEntity() }.toMutableList()
        ).also { reverseEntity ->
            reverseEntity.output.forEach { it.reverse = reverseEntity }
        }

    private fun ImportedReverseOutputDefinition.toEntity(): ReverseOutput =
        ReverseOutput(
            phase = entityManager.getReference(ActionPhasesDictionary::class.java, phase.orEmpty()),
            name = name.normalizedOrNull(),
            rule = rule.normalizedOrNull(),
            body = body?.toEntity() ?: Body(),
            log = log?.toEntity() ?: EventLog(),
            parent = parent?.toEntity()
        )

    private fun ImportedLogDefinition.toEntity(): Log =
        Log(journalServiceName = journalServiceName.normalizedOrNull())

    private fun ImportedAuditDefinition.toEntity(): Audit =
        Audit(
            enabled = enabled,
            eventCode = eventCode.normalizedOrNull(),
            eventDescription = eventDescription.normalizedOrNull()
        )

    private fun ImportedEventLogDefinition.toEntity(): EventLog =
        EventLog(
            journalServiceName = journalServiceName.orEmpty(),
            message = message.normalizedOrNull()
        )

    private fun ImportedBodyDefinition.toEntity(): Body =
        Body(
            eventObject = eventObject?.toEntity(),
            service = service?.toEntity(),
            type = type.normalizedOrNull()
        )

    private fun ImportedParentDefinition.toEntity(): Parent =
        Parent(
            include = include,
            mode = mode
        )

    private fun ImportedEventObjectDefinition.toEntity(): EventObject =
        EventObject(type = type.normalizedOrNull())

    private fun ImportedServiceDefinition.toEntity(): ServiceBody =
        ServiceBody(
            scenario = scenario.orEmpty(),
            type = type.normalizedOrNull(),
            status = status.refOrNull(B3StatusDictionary::class.java),
            sla = sla?.toEntity()
        )

    private fun ImportedSlaStateDefinition.toEntity(): SlaState =
        SlaState(
            status = status.refOrNull(SlaStatusDictionary::class.java),
            durationValue = durationValue,
            durationUnit = durationUnit.refOrNull(SlaDurationUnitDictionary::class.java)
        )

    private fun String?.normalizedOrNull(): String? =
        this?.trim()?.takeIf { it.isNotEmpty() }

    private fun <T> String?.refOrNull(type: Class<T>): T? {
        val code = normalizedOrNull() ?: return null
        return entityManager.getReference(type, code)
    }
}

@JsonIgnoreProperties(ignoreUnknown = false)
data class ImportedProcessDefinition(
    val id: String? = null,
    @field:JsonProperty("context-code")
    @field:JsonAlias("contextCode")
    val contextCode: String? = null,
    val disabled: Boolean = false,
    @field:JsonProperty("node_name")
    @field:JsonAlias("nodeName")
    val nodeName: String? = null,
    @field:JsonProperty("node_comment")
    @field:JsonAlias("nodeComment")
    val nodeComment: String? = null,
    val subprocess: List<ImportedSubprocessDefinition> = emptyList()
)

@JsonIgnoreProperties(ignoreUnknown = false)
data class ImportedSubprocessDefinition(
    val id: String? = null,
    @field:JsonProperty("context-code")
    @field:JsonAlias("contextCode")
    val contextCode: String? = null,
    @field:JsonProperty("node_name")
    @field:JsonAlias("nodeName")
    val nodeName: String? = null,
    @field:JsonProperty("node_comment")
    @field:JsonAlias("nodeComment")
    val nodeComment: String? = null,
    val disabled: Boolean = false,
    val trigger: ImportedTriggerDefinition = ImportedTriggerDefinition(),
    val stages: List<ImportedStageDefinition> = emptyList()
)

@JsonIgnoreProperties(ignoreUnknown = false)
data class ImportedStageDefinition(
    val id: String? = null,
    val executor: String? = null,
    val log: ImportedLogDefinition? = null,
    @field:JsonProperty("context-code")
    @field:JsonAlias("contextCode")
    val contextCode: String? = null,
    @field:JsonProperty("node_name")
    @field:JsonAlias("nodeName")
    val nodeName: String? = null,
    @field:JsonProperty("node_comment")
    @field:JsonAlias("nodeComment")
    val nodeComment: String? = null,
    val configurator: ImportedConfiguratorDefinition = ImportedConfiguratorDefinition()
)

@JsonIgnoreProperties(ignoreUnknown = false)
data class ImportedConfiguratorDefinition(
    val id: String? = null,
    val disabled: Boolean = false,
    val interrupted: Boolean = true,
    val multiple: Boolean = false,
    val audit: ImportedAuditDefinition? = null,
    @field:JsonProperty("filter-event-rule")
    @field:JsonAlias("filterEventRule")
    val filterEventRule: String? = null,
    val result: List<ImportedResultDefinition> = emptyList()
)

@JsonIgnoreProperties(ignoreUnknown = false)
data class ImportedResultDefinition(
    val id: String? = null,
    @field:JsonProperty("input-scenarios")
    @field:JsonAlias("inputScenarios")
    val inputScenarios: List<String> = emptyList(),
    val reverse: List<ImportedReverseDefinition> = emptyList()
)

@JsonIgnoreProperties(ignoreUnknown = false)
data class ImportedReverseDefinition(
    val id: String? = null,
    val status: String? = null,
    val output: List<ImportedReverseOutputDefinition> = emptyList()
)

@JsonIgnoreProperties(ignoreUnknown = false)
data class ImportedReverseOutputDefinition(
    val id: String? = null,
    val phase: String? = null,
    val name: String? = null,
    val rule: String? = null,
    val body: ImportedBodyDefinition? = null,
    val log: ImportedEventLogDefinition? = null,
    val parent: ImportedParentDefinition? = null
)

@JsonIgnoreProperties(ignoreUnknown = false)
data class ImportedParentDefinition(
    val include: Boolean? = null,
    val mode: ParentMode? = null
)

@JsonIgnoreProperties(ignoreUnknown = false)
data class ImportedBodyDefinition(
    @field:JsonProperty("event-object")
    @field:JsonAlias("eventObject")
    val eventObject: ImportedEventObjectDefinition? = null,
    val service: ImportedServiceDefinition? = null,
    val type: String? = null
)

@JsonIgnoreProperties(ignoreUnknown = false)
data class ImportedServiceDefinition(
    val scenario: String? = null,
    val type: String? = null,
    val status: String? = null,
    val sla: ImportedSlaStateDefinition? = null
)

@JsonIgnoreProperties(ignoreUnknown = false)
data class ImportedSlaStateDefinition(
    val status: String? = null,
    @field:JsonProperty("duration_value")
    @field:JsonAlias("durationValue")
    val durationValue: Int? = null,
    @field:JsonProperty("duration_unit")
    @field:JsonAlias("durationUnit")
    val durationUnit: String? = null
)

@JsonIgnoreProperties(ignoreUnknown = false)
data class ImportedEventObjectDefinition(
    val type: String? = null
)

@JsonIgnoreProperties(ignoreUnknown = false)
data class ImportedLogDefinition(
    @field:JsonProperty("journal-service-name")
    @field:JsonAlias("journalServiceName")
    val journalServiceName: String? = null
)

@JsonIgnoreProperties(ignoreUnknown = false)
data class ImportedEventLogDefinition(
    @field:JsonProperty("journal-service-name")
    @field:JsonAlias("journalServiceName")
    val journalServiceName: String? = null,
    val message: String? = null
)

@JsonIgnoreProperties(ignoreUnknown = false)
data class ImportedAuditDefinition(
    val enabled: Boolean = false,
    @field:JsonProperty("event-code")
    @field:JsonAlias("eventCode")
    val eventCode: String? = null,
    @field:JsonProperty("event-description")
    @field:JsonAlias("eventDescription")
    val eventDescription: String? = null
)

@JsonIgnoreProperties(ignoreUnknown = false)
data class ImportedTriggerDefinition(
    val rule: String? = null
)
