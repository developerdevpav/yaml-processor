package com.sber.yamlprocessor.graphql

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.JsonNodeFactory
import com.fasterxml.jackson.databind.node.ArrayNode
import com.fasterxml.jackson.databind.node.ObjectNode
import com.fasterxml.jackson.dataformat.yaml.YAMLMapper
import com.sber.yamlprocessor.importer.YamlImportScheme
import com.sber.yamlprocessor.model.ContextCodesDictionary
import com.sber.yamlprocessor.model.ProcessConfig
import com.sber.yamlprocessor.model.Process
import com.sber.yamlprocessor.model.Result
import com.sber.yamlprocessor.model.Reverse
import com.sber.yamlprocessor.model.ReverseOutput
import com.sber.yamlprocessor.model.Stage
import com.sber.yamlprocessor.model.Subprocess
import com.sber.yamlprocessor.model.Configurator
import com.sber.yamlprocessor.model.DictionaryEntity
import graphql.schema.idl.RuntimeWiring
import jakarta.persistence.ElementCollection
import jakarta.persistence.Embeddable
import jakarta.persistence.Embedded
import jakarta.persistence.EntityManager
import jakarta.persistence.EntityManagerFactory
import jakarta.persistence.Id
import jakarta.persistence.ManyToOne
import jakarta.persistence.OneToMany
import jakarta.persistence.OneToOne
import jakarta.persistence.metamodel.Attribute
import jakarta.persistence.metamodel.EntityType
import jakarta.persistence.metamodel.PluralAttribute
import org.hibernate.Hibernate
import org.hibernate.annotations.Immutable
import org.slf4j.LoggerFactory
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.core.io.ByteArrayResource
import org.springframework.graphql.execution.GraphQlSource
import org.springframework.graphql.execution.RuntimeWiringConfigurer
import org.springframework.stereotype.Component
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.yaml.snakeyaml.DumperOptions
import org.yaml.snakeyaml.Yaml
import org.yaml.snakeyaml.nodes.Node
import org.yaml.snakeyaml.nodes.Tag
import org.yaml.snakeyaml.representer.Represent
import org.yaml.snakeyaml.representer.Representer
import java.text.Normalizer
import java.lang.reflect.Field
import java.lang.reflect.Member
import java.lang.reflect.Method
import java.lang.reflect.Modifier
import java.nio.charset.StandardCharsets
import java.util.Collections
import java.util.IdentityHashMap
import java.util.LinkedHashMap
import java.util.UUID

@Configuration
class JpaGraphQlConfiguration {
    @Bean
    fun jpaGraphQlSource(
        schemaFactory: JpaGraphQlSchemaFactory,
        runtimeWiringConfigurer: RuntimeWiringConfigurer
    ): GraphQlSource {
        val schema = schemaFactory.render()
        return GraphQlSource.schemaResourceBuilder()
            .schemaResources(ByteArrayResource(schema.toByteArray(StandardCharsets.UTF_8)))
            .configureRuntimeWiring(runtimeWiringConfigurer)
            .build()
    }
}

@Component
class JpaGraphQlSchemaFactory(
    private val registry: JpaGraphQlRegistry
) {
    fun render(): String {
        val queryFields = registry.entities.values.flatMap { entity ->
            listOf(
                "  ${entity.queryField}(id: ID!): ${entity.name}",
                "  ${entity.listField}: [${entity.name}!]!"
            )
        }

        val mutationFields = registry.entities.values
            .filter { it.mutable }
            .flatMap { entity ->
                listOf(
                    "  create${entity.name}(input: ${entity.inputName}!): ${entity.name}!",
                    "  update${entity.name}(id: ID!, input: ${entity.inputName}!): ${entity.name}!",
                    "  delete${entity.name}(id: ID!): Boolean!"
                )
            } + listOf(
                "  createSubprocessNode(processId: ID!, input: SubprocessInput!): Subprocess!",
                "  updateSubprocessNode(id: ID!, input: SubprocessInput!): Subprocess!",
                "  reorderSubprocessStages(subprocessId: ID!, stageIds: [ID!]!): Subprocess!",
                "  deleteSubprocessNode(id: ID!): Boolean!",
                "  createStageNode(subprocessId: ID!, input: StageInput!): Stage!",
                "  updateStageNode(id: ID!, input: StageInput!): Stage!",
                "  deleteStageNode(id: ID!): Boolean!",
                "  createConfiguratorNode(stageId: ID!, input: ConfiguratorInput!): Configurator!",
                "  updateConfiguratorNode(id: ID!, input: ConfiguratorInput!): Configurator!",
                "  deleteConfiguratorNode(id: ID!): Boolean!",
                "  createResultNode(configuratorId: ID!, input: ResultInput!): Result!",
                "  updateResultNode(id: ID!, input: ResultInput!): Result!",
                "  deleteResultNode(id: ID!): Boolean!",
                "  createReverseNode(resultId: ID!, input: ReverseInput!): Reverse!",
                "  updateReverseNode(id: ID!, input: ReverseInput!): Reverse!",
                "  deleteReverseNode(id: ID!): Boolean!",
                "  createReverseOutputNode(reverseId: ID!, input: ReverseOutputInput!): ReverseOutput!",
                "  updateReverseOutputNode(id: ID!, input: ReverseOutputInput!): ReverseOutput!",
                "  deleteReverseOutputNode(id: ID!): Boolean!",
                "  updateProcessNode(id: ID!, input: ProcessInput!): Process!"
            )

        val types = registry.entities.values.joinToString("\n\n") { renderComplexType(it) }
        val embeddables = registry.embeddables.values.joinToString("\n\n") { renderComplexType(it) }
        val inputs = registry.entities.values.joinToString("\n\n") { renderInputType(it) }
        val embeddableInputs = registry.embeddables.values.joinToString("\n\n") { renderInputType(it) }
        val refs = registry.referenceInputs.values.joinToString("\n\n") { ref ->
            buildString {
                appendLine("input ${ref.name} {")
                appendLine("  ${ref.idField}: ID!")
                append("}")
            }
        }

        return buildString {
            appendLine("type Query {")
            queryFields.forEach(::appendLine)
            appendLine("}")
            if (mutationFields.isNotEmpty()) {
                appendLine()
                appendLine("type Mutation {")
                mutationFields.forEach(::appendLine)
                appendLine("}")
            }
            appendLine()
            appendLine(types)
            if (embeddables.isNotBlank()) {
                appendLine()
                appendLine(embeddables)
            }
            appendLine()
            appendLine(inputs)
            if (embeddableInputs.isNotBlank()) {
                appendLine()
                appendLine(embeddableInputs)
            }
            if (refs.isNotBlank()) {
                appendLine()
                appendLine(refs)
            }
        }
    }

    private fun renderComplexType(type: ComplexTypeMetadata): String = buildString {
        appendLine("type ${type.name} {")
        type.fields.forEach { field ->
            appendLine("  ${field.name}: ${field.outputType}")
        }
        append("}")
    }

    private fun renderInputType(type: ComplexTypeMetadata): String = buildString {
        appendLine("input ${type.inputName} {")
        type.fields.filter { it.inputType != null }.forEach { field ->
            appendLine("  ${field.name}: ${field.inputType}")
        }
        append("}")
    }
}

@Component
class JpaGraphQlRuntimeWiringConfigurer(
    private val registry: JpaGraphQlRegistry,
    private val service: JpaGraphQlCrudService
) : RuntimeWiringConfigurer {
    override fun configure(builder: RuntimeWiring.Builder) {
        builder.type("Query") { type ->
            registry.entities.values.forEach { entity ->
                type.dataFetcher(entity.queryField) { env ->
                    service.findById(entity, env.getArgument("id"))
                }
                type.dataFetcher(entity.listField) {
                    service.findAll(entity)
                }
            }
            type
        }

        builder.type("Mutation") { type ->
            registry.entities.values.filter { it.mutable }.forEach { entity ->
                type.dataFetcher("create${entity.name}") { env ->
                    @Suppress("UNCHECKED_CAST")
                    service.create(entity, env.getArgument<Map<String, Any?>>("input"))
                }
                type.dataFetcher("update${entity.name}") { env ->
                    @Suppress("UNCHECKED_CAST")
                    service.update(entity, env.getArgument("id"), env.getArgument<Map<String, Any?>>("input"))
                }
                type.dataFetcher("delete${entity.name}") { env ->
                    service.delete(entity, env.getArgument("id"))
                }
            }
            type.dataFetcher("updateStageNode") { env ->
                @Suppress("UNCHECKED_CAST")
                service.updateStageNode(env.getArgument("id"), env.getArgument<Map<String, Any?>>("input"))
            }
            type.dataFetcher("createSubprocessNode") { env ->
                @Suppress("UNCHECKED_CAST")
                service.createSubprocessNode(env.getArgument("processId"), env.getArgument<Map<String, Any?>>("input"))
            }
            type.dataFetcher("updateSubprocessNode") { env ->
                @Suppress("UNCHECKED_CAST")
                service.updateSubprocessNode(env.getArgument("id"), env.getArgument<Map<String, Any?>>("input"))
            }
            type.dataFetcher("reorderSubprocessStages") { env ->
                service.reorderSubprocessStages(
                    env.getArgument("subprocessId"),
                    env.getArgument<List<Any?>>("stageIds")
                )
            }
            type.dataFetcher("deleteSubprocessNode") { env ->
                service.deleteSubprocessNode(env.getArgument("id"))
            }
            type.dataFetcher("createStageNode") { env ->
                @Suppress("UNCHECKED_CAST")
                service.createStageNode(env.getArgument("subprocessId"), env.getArgument<Map<String, Any?>>("input"))
            }
            type.dataFetcher("deleteStageNode") { env ->
                service.deleteStageNode(env.getArgument("id"))
            }
            type.dataFetcher("createConfiguratorNode") { env ->
                @Suppress("UNCHECKED_CAST")
                service.createConfiguratorNode(env.getArgument("stageId"), env.getArgument<Map<String, Any?>>("input"))
            }
            type.dataFetcher("updateConfiguratorNode") { env ->
                @Suppress("UNCHECKED_CAST")
                service.updateConfiguratorNode(env.getArgument("id"), env.getArgument<Map<String, Any?>>("input"))
            }
            type.dataFetcher("deleteConfiguratorNode") { env ->
                service.deleteConfiguratorNode(env.getArgument("id"))
            }
            type.dataFetcher("createResultNode") { env ->
                @Suppress("UNCHECKED_CAST")
                service.createResultNode(env.getArgument("configuratorId"), env.getArgument<Map<String, Any?>>("input"))
            }
            type.dataFetcher("updateResultNode") { env ->
                @Suppress("UNCHECKED_CAST")
                service.updateResultNode(env.getArgument("id"), env.getArgument<Map<String, Any?>>("input"))
            }
            type.dataFetcher("deleteResultNode") { env ->
                service.deleteResultNode(env.getArgument("id"))
            }
            type.dataFetcher("createReverseNode") { env ->
                @Suppress("UNCHECKED_CAST")
                service.createReverseNode(env.getArgument("resultId"), env.getArgument<Map<String, Any?>>("input"))
            }
            type.dataFetcher("updateReverseNode") { env ->
                @Suppress("UNCHECKED_CAST")
                service.updateReverseNode(env.getArgument("id"), env.getArgument<Map<String, Any?>>("input"))
            }
            type.dataFetcher("deleteReverseNode") { env ->
                service.deleteReverseNode(env.getArgument("id"))
            }
            type.dataFetcher("createReverseOutputNode") { env ->
                @Suppress("UNCHECKED_CAST")
                service.createReverseOutputNode(env.getArgument("reverseId"), env.getArgument<Map<String, Any?>>("input"))
            }
            type.dataFetcher("updateReverseOutputNode") { env ->
                @Suppress("UNCHECKED_CAST")
                service.updateReverseOutputNode(env.getArgument("id"), env.getArgument<Map<String, Any?>>("input"))
            }
            type.dataFetcher("deleteReverseOutputNode") { env ->
                service.deleteReverseOutputNode(env.getArgument("id"))
            }
            type.dataFetcher("updateProcessNode") { env ->
                @Suppress("UNCHECKED_CAST")
                service.updateProcessNode(env.getArgument("id"), env.getArgument<Map<String, Any?>>("input"))
            }
            type
        }
    }
}

@Service
class JpaGraphQlCrudService(
    private val entityManager: EntityManager,
    private val objectMapper: ObjectMapper,
    private val registry: JpaGraphQlRegistry
) {
    private val logger = LoggerFactory.getLogger(JpaGraphQlCrudService::class.java)

    @Transactional(readOnly = true)
    fun findProcessConfigForExport(id: Any?): ProcessConfig {
        val entity = registry.entity(ProcessConfig::class.java)
        val entityId = convertId(id, entity.idJavaType)
        val config = entityManager.find(ProcessConfig::class.java, entityId)
            ?: error("ProcessConfig with id=$entityId not found")
        initializeGraph(config, entity)
        return config
    }

    @Transactional(readOnly = true)
    fun findById(entity: EntityMetadata, id: Any?): Any? =
        entityManager.find(entity.javaType, convertId(id, entity.idJavaType))
            ?.also { initializeGraph(it, entity) }

    @Transactional(readOnly = true)
    fun findAll(entity: EntityMetadata): List<Any> =
        entityManager.createQuery("select e from ${entity.jpaName} e", entity.javaType)
            .resultList
            .map { it as Any }
            .onEach { initializeGraph(it, entity) }

    @Transactional
    fun create(entity: EntityMetadata, input: Map<String, Any?>): Any {
        val instance = objectMapper.convertValue(input, entity.javaType)
        coerceReferenceFields(instance, input, entity)
        sanitize(instance, entity)
        entityManager.persist(instance)
        entityManager.flush()
        initializeGraph(instance, entity)
        return instance
    }

    @Transactional
    fun update(entity: EntityMetadata, id: Any?, input: Map<String, Any?>): Any {
        val entityId = convertId(id, entity.idJavaType)
        val current = entityManager.find(entity.javaType, entityId)
            ?: error("${entity.name} with id=$entityId not found")
        val instance = objectMapper.convertValue(input, entity.javaType)
        coerceReferenceFields(instance, input, entity)
        setFieldValue(instance, entity.idField.name, entityId)
        alignChildIdentifiers(current, instance, entity)
        sanitize(instance, entity)
        val merged = entityManager.merge(instance)
        entityManager.flush()
        initializeGraph(merged, entity)
        return merged
    }

    @Transactional
    fun updateStageNode(id: Any?, input: Map<String, Any?>): Stage {
        val entity = registry.entity(Stage::class.java)
        val entityId = convertId(id, entity.idJavaType)
        val current = entityManager.find(Stage::class.java, entityId)
            ?: error("Stage with id=$entityId not found")
        logger.info(
            "updateStageNode start: stageId={}, currentConfiguratorId={}, currentSubprocessId={}, input={}",
            entityId,
            current.configurator?.id,
            current.subprocess?.id,
            safeJson(input)
        )
        if (input.containsKey("executor")) {
            current.executor = input["executor"]?.toString() ?: ""
        }
        if (input.containsKey("nodeName")) {
            current.nodeName = input["nodeName"]?.toString()?.ifBlank { null }
        }
        if (input.containsKey("nodeComment")) {
            current.nodeComment = input["nodeComment"]?.toString()?.ifBlank { null }
        }
        if (input.containsKey("contextCode")) {
            @Suppress("UNCHECKED_CAST")
            val contextInput = input["contextCode"] as Map<String, Any?>?
            val contextCode = contextInput?.get("code")?.toString()?.trim().orEmpty()
            current.contextCode = if (contextCode.isBlank()) {
                null
            } else {
                entityManager.getReference(ContextCodesDictionary::class.java, contextCode)
            }
        }
        if (input.containsKey("log")) {
            @Suppress("UNCHECKED_CAST")
            val logInput = input["log"] as Map<String, Any?>?
            current.log = (current.log ?: com.sber.yamlprocessor.model.Log()).apply {
                journalServiceName = logInput?.get("journalServiceName")?.toString()?.ifBlank { null }
            }
        }
        logger.info(
            "updateStageNode mapped: stageId={}, incomingExecutor={}, incomingNodeName={}, incomingNodeComment={}, incomingConfiguratorId={}",
            entityId,
            current.executor,
            current.nodeName,
            current.nodeComment,
            current.configurator?.id
        )

        sanitize(current, entity)

        val merged = entityManager.merge(current)
        try {
            entityManager.flush()
        } catch (exception: Exception) {
            logger.error(
                "updateStageNode flush failed: stageId={}, mergedConfiguratorId={}, mergedSubprocessId={}, mergedNodeName={}, mergedNodeComment={}, mergedExecutor={}",
                entityId,
                merged.configurator?.id,
                merged.subprocess?.id,
                merged.nodeName,
                merged.nodeComment,
                merged.executor,
                exception
            )
            throw exception
        }
        logger.info(
            "updateStageNode success: stageId={}, persistedConfiguratorId={}, persistedSubprocessId={}, persistedNodeName={}, persistedNodeComment={}, persistedExecutor={}",
            entityId,
            merged.configurator?.id,
            merged.subprocess?.id,
            merged.nodeName,
            merged.nodeComment,
            merged.executor
        )
        initializeGraph(merged, entity)
        return merged as Stage
    }

    @Transactional
    fun createSubprocessNode(processId: Any?, input: Map<String, Any?>): Subprocess {
        val parentId = convertId(processId, UUID::class.java)
        val process = entityManager.find(Process::class.java, parentId)
            ?: error("Process with id=$parentId not found")
        val entity = registry.entity(Subprocess::class.java)
        val subprocess = objectMapper.convertValue(input, Subprocess::class.java)
        coerceReferenceFields(subprocess, input, entity)
        subprocess.process = process
        sanitize(subprocess, entity)
        process.subprocess.add(subprocess)
        entityManager.persist(subprocess)
        entityManager.flush()
        initializeGraph(subprocess, entity)
        return subprocess
    }

    @Transactional
    fun updateSubprocessNode(id: Any?, input: Map<String, Any?>): Subprocess {
        val entity = registry.entity(Subprocess::class.java)
        val entityId = convertId(id, entity.idJavaType)
        val current = entityManager.find(Subprocess::class.java, entityId)
            ?: error("Subprocess with id=$entityId not found")

        if (input.containsKey("nodeName")) {
            current.nodeName = input["nodeName"]?.toString()?.ifBlank { null }
        }

        if (input.containsKey("nodeComment")) {
            current.nodeComment = input["nodeComment"]?.toString()?.ifBlank { null }
        }

        if (input.containsKey("disabled")) {
            current.disabled = input["disabled"] as? Boolean ?: false
        }

        if (input.containsKey("trigger")) {
            @Suppress("UNCHECKED_CAST")
            val triggerInput = input["trigger"] as Map<String, Any?>?
            current.trigger.rule = triggerInput?.get("rule")?.toString() ?: ""
        }

        entityManager.flush()
        initializeGraph(current, entity)
        return current
    }

    @Transactional
    fun reorderSubprocessStages(subprocessId: Any?, stageIds: List<Any?>): Subprocess {
        val entity = registry.entity(Subprocess::class.java)
        val entityId = convertId(subprocessId, entity.idJavaType)
        val current = entityManager.find(Subprocess::class.java, entityId)
            ?: error("Subprocess with id=$entityId not found")

        val currentStages = current.stages.toList()
        val currentStageIds = currentStages.mapNotNull { it.id }
        val requestedStageIds = stageIds.map { convertId(it, UUID::class.java) as UUID }

        require(requestedStageIds.size == currentStages.size) {
            "Expected ${currentStages.size} stage ids for subprocess $entityId, got ${requestedStageIds.size}"
        }
        require(requestedStageIds.distinct().size == requestedStageIds.size) {
            "Stage ids for subprocess $entityId must be unique"
        }
        require(currentStageIds.toSet() == requestedStageIds.toSet()) {
            "Stage ids do not match subprocess $entityId current stages"
        }

        val stageById = currentStages.associateBy { it.id }
        requestedStageIds.forEachIndexed { index, stageId ->
            current.stages[index] = stageById.getValue(stageId)
        }

        entityManager.flush()
        initializeGraph(current, entity)
        return current
    }

    @Transactional
    fun deleteSubprocessNode(id: Any?): Boolean {
        val entityId = convertId(id, UUID::class.java)
        val subprocess = entityManager.find(Subprocess::class.java, entityId) ?: return false
        subprocess.process?.subprocess?.removeIf { it.id == subprocess.id }
        entityManager.flush()
        return true
    }

    @Transactional
    fun createStageNode(subprocessId: Any?, input: Map<String, Any?>): Stage {
        val parentId = convertId(subprocessId, UUID::class.java)
        val subprocess = entityManager.find(Subprocess::class.java, parentId)
            ?: error("Subprocess with id=$parentId not found")
        val entity = registry.entity(Stage::class.java)
        val stage = objectMapper.convertValue(input, Stage::class.java)
        coerceReferenceFields(stage, input, entity)
        stage.subprocess = subprocess
        sanitize(stage, entity)
        subprocess.stages.add(stage)
        entityManager.persist(stage)
        entityManager.flush()
        initializeGraph(stage, entity)
        return stage
    }

    @Transactional
    fun updateProcessNode(id: Any?, input: Map<String, Any?>): Process {
        val entity = registry.entity(Process::class.java)
        val entityId = convertId(id, entity.idJavaType)
        val current = entityManager.find(Process::class.java, entityId)
            ?: error("Process with id=$entityId not found")

        if (input.containsKey("nodeName")) {
            current.nodeName = input["nodeName"]?.toString()?.ifBlank { null }
        }

        if (input.containsKey("nodeComment")) {
            current.nodeComment = input["nodeComment"]?.toString()?.ifBlank { null }
        }

        if (input.containsKey("contextCode")) {
            @Suppress("UNCHECKED_CAST")
            val contextInput = input["contextCode"] as Map<String, Any?>?
            val contextCode = contextInput?.get("code")?.toString()?.trim().orEmpty()
            current.contextCode = if (contextCode.isBlank()) {
                null
            } else {
                entityManager.getReference(ContextCodesDictionary::class.java, contextCode)
            }
        }

        entityManager.flush()
        initializeGraph(current, entity)
        return current
    }

    @Transactional
    fun deleteStageNode(id: Any?): Boolean {
        val entityId = convertId(id, UUID::class.java)
        val stage = entityManager.find(Stage::class.java, entityId) ?: return false
        stage.subprocess?.stages?.removeIf { it.id == stage.id }
        entityManager.flush()
        return true
    }

    @Transactional
    fun createConfiguratorNode(stageId: Any?, input: Map<String, Any?>): Configurator {
        val parentId = convertId(stageId, UUID::class.java)
        val stage = entityManager.find(Stage::class.java, parentId)
            ?: error("Stage with id=$parentId not found")
        require(stage.configurator == null) { "Stage with id=$parentId already has configurator" }

        val entity = registry.entity(Configurator::class.java)
        val configurator = objectMapper.convertValue(input, Configurator::class.java)
        coerceReferenceFields(configurator, input, entity)
        configurator.stage = stage
        sanitize(configurator, entity)
        entityManager.persist(configurator)
        stage.configurator = configurator
        entityManager.flush()
        initializeGraph(configurator, entity)
        return configurator
    }

    @Transactional
    fun updateConfiguratorNode(id: Any?, input: Map<String, Any?>): Configurator {
        val entity = registry.entity(Configurator::class.java)
        val entityId = convertId(id, entity.idJavaType)
        val current = entityManager.find(Configurator::class.java, entityId)
            ?: error("Configurator with id=$entityId not found")
        logger.info(
            "updateConfiguratorNode start: configuratorId={}, currentStageId={}, input={}",
            entityId,
            current.stage?.id,
            safeJson(input)
        )
        if (input.containsKey("disabled")) {
            current.disabled = input["disabled"] as? Boolean ?: false
        }
        if (input.containsKey("interrupted")) {
            current.interrupted = input["interrupted"] as? Boolean ?: true
        }
        if (input.containsKey("multiple")) {
            current.multiple = input["multiple"] as? Boolean ?: false
        }
        if (input.containsKey("filterEventRule")) {
            current.filterEventRule = input["filterEventRule"]?.toString() ?: ""
        }
        if (input.containsKey("audit")) {
            @Suppress("UNCHECKED_CAST")
            val auditInput = input["audit"] as Map<String, Any?>?
            current.audit = (current.audit ?: com.sber.yamlprocessor.model.Audit()).apply {
                enabled = auditInput?.get("enabled") as? Boolean ?: false
                eventCode = auditInput?.get("eventCode")?.toString()?.ifBlank { null }
                eventDescription = auditInput?.get("eventDescription")?.toString()?.ifBlank { null }
            }
        }
        sanitize(current, entity)
        val merged = entityManager.merge(current)
        try {
            entityManager.flush()
        } catch (exception: Exception) {
            logger.error(
                "updateConfiguratorNode flush failed: configuratorId={}, stageId={}, disabled={}, interrupted={}, multiple={}, auditEnabled={}, filterEventRuleLength={}",
                entityId,
                merged.stage?.id,
                merged.disabled,
                merged.interrupted,
                merged.multiple,
                merged.audit?.enabled,
                merged.filterEventRule?.length ?: 0,
                exception
            )
            throw exception
        }
        logger.info(
            "updateConfiguratorNode success: configuratorId={}, stageId={}, disabled={}, interrupted={}, multiple={}, auditEnabled={}, filterEventRuleLength={}",
            entityId,
            merged.stage?.id,
            merged.disabled,
            merged.interrupted,
            merged.multiple,
            merged.audit?.enabled,
            merged.filterEventRule?.length ?: 0
        )
        initializeGraph(merged, entity)
        return merged as Configurator
    }

    @Transactional
    fun deleteConfiguratorNode(id: Any?): Boolean {
        val entityId = convertId(id, UUID::class.java)
        val configurator = entityManager.find(Configurator::class.java, entityId) ?: return false
        configurator.stage?.configurator = null
        entityManager.remove(configurator)
        entityManager.flush()
        return true
    }

    @Transactional
    fun createResultNode(configuratorId: Any?, input: Map<String, Any?>): Result {
        val parentId = convertId(configuratorId, UUID::class.java)
        val configurator = entityManager.find(Configurator::class.java, parentId)
            ?: error("Configurator with id=$parentId not found")
        val entity = registry.entity(Result::class.java)
        val result = objectMapper.convertValue(input, Result::class.java)
        coerceReferenceFields(result, input, entity)
        result.configurator = configurator
        sanitize(result, entity)
        configurator.result.add(result)
        entityManager.persist(result)
        entityManager.flush()
        initializeGraph(result, entity)
        return result
    }

    @Transactional
    fun updateResultNode(id: Any?, input: Map<String, Any?>): Result {
        val entity = registry.entity(Result::class.java)
        val entityId = convertId(id, entity.idJavaType)
        val current = entityManager.find(Result::class.java, entityId)
            ?: error("Result with id=$entityId not found")
        val incoming = objectMapper.convertValue(input, Result::class.java)
        coerceReferenceFields(incoming, input, entity)
        setFieldValue(incoming, entity.idField.name, entityId)
        incoming.configurator = current.configurator
        alignChildIdentifiers(current, incoming, entity)
        sanitize(incoming, entity)
        val merged = entityManager.merge(incoming)
        entityManager.flush()
        initializeGraph(merged, entity)
        return merged as Result
    }

    @Transactional
    fun deleteResultNode(id: Any?): Boolean {
        val entityId = convertId(id, UUID::class.java)
        val result = entityManager.find(Result::class.java, entityId) ?: return false
        result.configurator?.result?.removeIf { it.id == result.id }
        entityManager.flush()
        return true
    }

    @Transactional
    fun createReverseNode(resultId: Any?, input: Map<String, Any?>): Reverse {
        val parentId = convertId(resultId, UUID::class.java)
        val result = entityManager.find(Result::class.java, parentId)
            ?: error("Result with id=$parentId not found")
        val entity = registry.entity(Reverse::class.java)
        val reverse = objectMapper.convertValue(input, Reverse::class.java)
        coerceReferenceFields(reverse, input, entity)
        reverse.result = result
        sanitize(reverse, entity)
        result.reverse.add(reverse)
        entityManager.persist(reverse)
        entityManager.flush()
        initializeGraph(reverse, entity)
        return reverse
    }

    @Transactional
    fun updateReverseNode(id: Any?, input: Map<String, Any?>): Reverse {
        val entity = registry.entity(Reverse::class.java)
        val entityId = convertId(id, entity.idJavaType)
        val current = entityManager.find(Reverse::class.java, entityId)
            ?: error("Reverse with id=$entityId not found")
        val incoming = objectMapper.convertValue(input, Reverse::class.java)
        coerceReferenceFields(incoming, input, entity)
        setFieldValue(incoming, entity.idField.name, entityId)
        incoming.result = current.result
        alignChildIdentifiers(current, incoming, entity)
        sanitize(incoming, entity)
        val merged = entityManager.merge(incoming)
        entityManager.flush()
        initializeGraph(merged, entity)
        return merged as Reverse
    }

    @Transactional
    fun deleteReverseNode(id: Any?): Boolean {
        val entityId = convertId(id, UUID::class.java)
        val reverse = entityManager.find(Reverse::class.java, entityId) ?: return false
        reverse.result?.reverse?.removeIf { it.id == reverse.id }
        entityManager.flush()
        return true
    }

    @Transactional
    fun createReverseOutputNode(reverseId: Any?, input: Map<String, Any?>): ReverseOutput {
        val parentId = convertId(reverseId, UUID::class.java)
        val reverse = entityManager.find(Reverse::class.java, parentId)
            ?: error("Reverse with id=$parentId not found")
        val entity = registry.entity(ReverseOutput::class.java)
        val output = objectMapper.convertValue(input, ReverseOutput::class.java)
        coerceReferenceFields(output, input, entity)
        output.reverse = reverse
        sanitize(output, entity)
        reverse.output.add(output)
        entityManager.persist(output)
        entityManager.flush()
        initializeGraph(output, entity)
        return output
    }

    @Transactional
    fun updateReverseOutputNode(id: Any?, input: Map<String, Any?>): ReverseOutput {
        val entity = registry.entity(ReverseOutput::class.java)
        val entityId = convertId(id, entity.idJavaType)
        val current = entityManager.find(ReverseOutput::class.java, entityId)
            ?: error("ReverseOutput with id=$entityId not found")
        val incoming = objectMapper.convertValue(input, ReverseOutput::class.java)
        coerceReferenceFields(incoming, input, entity)
        setFieldValue(incoming, entity.idField.name, entityId)
        incoming.reverse = current.reverse
        alignChildIdentifiers(current, incoming, entity)
        sanitize(incoming, entity)
        val merged = entityManager.merge(incoming)
        entityManager.flush()
        initializeGraph(merged, entity)
        return merged as ReverseOutput
    }

    @Transactional
    fun deleteReverseOutputNode(id: Any?): Boolean {
        val entityId = convertId(id, UUID::class.java)
        val output = entityManager.find(ReverseOutput::class.java, entityId) ?: return false
        output.reverse?.output?.removeIf { it.id == output.id }
        entityManager.flush()
        return true
    }

    @Transactional
    fun delete(entity: EntityMetadata, id: Any?): Boolean {
        val managed = entityManager.find(entity.javaType, convertId(id, entity.idJavaType)) ?: return false
        entityManager.remove(managed)
        entityManager.flush()
        return true
    }

    private fun sanitize(value: Any?, type: ComplexTypeMetadata) {
        if (value == null) {
            return
        }

        type.fields.forEach { field ->
            val current = getFieldValue(value, field.name) ?: return@forEach
            when (field.kind) {
                FieldKind.SCALAR, FieldKind.SCALAR_COLLECTION -> Unit
                FieldKind.EMBEDDED -> sanitize(current, registry.complexType(field.targetClass))
                FieldKind.ENTITY_REFERENCE -> {
                    val referenceField = findField(value.javaClass, field.name)
                    val referenceJavaType = referenceField.type
                    val target = registry.entity(referenceJavaType)
                    val refId = getFieldValue(current, target.idField.name)
                    if (refId == null) {
                        if (isInMemoryBackReference(current, value, target)) {
                            return@forEach
                        }
                        error("Reference ${field.name} must include ${target.idField.name}")
                    }
                    val normalizedReference = if (DictionaryEntity::class.java.isAssignableFrom(referenceJavaType)) {
                        instantiateDictionaryReference(referenceJavaType, refId)
                    } else {
                        instantiateReference(target, convertId(refId, target.idJavaType))
                    }
                    setFieldValue(value, field.name, normalizedReference)
                }
                FieldKind.ENTITY_CHILD -> {
                    field.inverseField?.let { setFieldValue(current, it, value) }
                    sanitize(current, registry.entity(field.targetClass))
                }
                FieldKind.ENTITY_CHILD_COLLECTION -> {
                    @Suppress("UNCHECKED_CAST")
                    (current as Iterable<Any>).forEach { child ->
                        field.inverseField?.let { setFieldValue(child, it, value) }
                        sanitize(child, registry.entity(field.targetClass))
                    }
                }
            }
        }
    }

    private fun coerceReferenceFields(value: Any?, input: Map<String, Any?>, type: ComplexTypeMetadata) {
        if (value == null) {
            return
        }

        type.fields.forEach { field ->
            val rawFieldValue = input[field.name] ?: return@forEach
            when (field.kind) {
                FieldKind.SCALAR, FieldKind.SCALAR_COLLECTION -> Unit
                FieldKind.EMBEDDED -> {
                    @Suppress("UNCHECKED_CAST")
                    val nestedInput = rawFieldValue as? Map<String, Any?> ?: return@forEach
                    val current = getFieldValue(value, field.name)
                        ?: objectMapper.convertValue(nestedInput, field.targetClass).also {
                            setFieldValue(value, field.name, it)
                        }
                    coerceReferenceFields(current, nestedInput, registry.complexType(field.targetClass))
                }
                FieldKind.ENTITY_REFERENCE -> {
                    @Suppress("UNCHECKED_CAST")
                    val refInput = rawFieldValue as? Map<String, Any?> ?: return@forEach
                    val referenceField = findField(value.javaClass, field.name)
                    val referenceJavaType = referenceField.type
                    val target = registry.entity(referenceJavaType)
                    val refId = refInput[target.idField.name] ?: return@forEach
                    val normalizedReference = if (DictionaryEntity::class.java.isAssignableFrom(referenceJavaType)) {
                        instantiateDictionaryReference(referenceJavaType, refId)
                    } else {
                        instantiateReference(target, convertId(refId, target.idJavaType))
                    }
                    setFieldValue(value, field.name, normalizedReference)
                }
                FieldKind.ENTITY_CHILD -> {
                    val current = getFieldValue(value, field.name) ?: return@forEach
                    @Suppress("UNCHECKED_CAST")
                    val nestedInput = rawFieldValue as? Map<String, Any?> ?: return@forEach
                    coerceReferenceFields(current, nestedInput, registry.entity(field.targetClass))
                }
                FieldKind.ENTITY_CHILD_COLLECTION -> {
                    @Suppress("UNCHECKED_CAST")
                    val currentItems = (getFieldValue(value, field.name) as? Iterable<Any>)?.toList() ?: return@forEach
                    @Suppress("UNCHECKED_CAST")
                    val nestedInputs = rawFieldValue as? List<Map<String, Any?>> ?: return@forEach
                    currentItems.zip(nestedInputs).forEach { (child, childInput) ->
                        coerceReferenceFields(child, childInput, registry.entity(field.targetClass))
                    }
                }
            }
        }
    }

    private fun isInMemoryBackReference(reference: Any, owner: Any, target: EntityMetadata): Boolean =
        target.fields
            .filter { candidate ->
                candidate.kind == FieldKind.ENTITY_CHILD || candidate.kind == FieldKind.ENTITY_CHILD_COLLECTION
            }
            .any { candidate ->
                val linked = getFieldValue(reference, candidate.name) ?: return@any false
                when (candidate.kind) {
                    FieldKind.ENTITY_CHILD -> linked === owner
                    FieldKind.ENTITY_CHILD_COLLECTION -> (linked as? Iterable<*>)?.any { it === owner } == true
                    else -> false
                }
            }

    private fun alignChildIdentifiers(current: Any?, incoming: Any?, type: ComplexTypeMetadata) {
        if (current == null || incoming == null) {
            return
        }

        if (type is EntityMetadata && getFieldValue(incoming, type.idField.name) == null) {
            setFieldValue(incoming, type.idField.name, getFieldValue(current, type.idField.name))
        }

        type.fields.forEach { field ->
            val currentValue = getFieldValue(current, field.name) ?: return@forEach
            val incomingValue = getFieldValue(incoming, field.name) ?: return@forEach

            when (field.kind) {
                FieldKind.SCALAR, FieldKind.SCALAR_COLLECTION, FieldKind.ENTITY_REFERENCE -> Unit
                FieldKind.EMBEDDED -> alignChildIdentifiers(
                    currentValue,
                    incomingValue,
                    registry.complexType(field.targetClass)
                )
                FieldKind.ENTITY_CHILD -> alignChildIdentifiers(
                    currentValue,
                    incomingValue,
                    registry.entity(field.targetClass)
                )
                FieldKind.ENTITY_CHILD_COLLECTION -> {
                    val childType = registry.entity(field.targetClass)
                    val currentItems = (currentValue as? Iterable<*>)?.toList().orEmpty()
                    val incomingItems = (incomingValue as? Iterable<*>)?.toList().orEmpty()
                    incomingItems.forEachIndexed { index, child ->
                        val existingChild = currentItems.getOrNull(index) ?: return@forEachIndexed
                        if (child != null) {
                            alignChildIdentifiers(existingChild, child, childType)
                        }
                    }
                }
            }
        }
    }

    private fun initializeGraph(value: Any?, type: ComplexTypeMetadata) {
        val visited = Collections.newSetFromMap(IdentityHashMap<Any, Boolean>())
        initializeGraph(value, type, visited)
    }

    private fun initializeGraph(value: Any?, type: ComplexTypeMetadata, visited: MutableSet<Any>) {
        if (value == null || !visited.add(value)) {
            return
        }

        type.fields.forEach { field ->
            val current = getFieldValue(value, field.name) ?: return@forEach
            when (field.kind) {
                FieldKind.SCALAR, FieldKind.SCALAR_COLLECTION -> Hibernate.initialize(current)
                FieldKind.EMBEDDED -> initializeGraph(current, registry.complexType(field.targetClass), visited)
                FieldKind.ENTITY_REFERENCE -> {
                    Hibernate.initialize(current)
                    initializeGraph(current, registry.entity(field.targetClass), visited)
                }
                FieldKind.ENTITY_CHILD -> {
                    Hibernate.initialize(current)
                    initializeGraph(current, registry.entity(field.targetClass), visited)
                }
                FieldKind.ENTITY_CHILD_COLLECTION -> {
                    Hibernate.initialize(current)
                    @Suppress("UNCHECKED_CAST")
                    (current as Iterable<Any>).forEach { child ->
                        initializeGraph(child, registry.entity(field.targetClass), visited)
                    }
                }
            }
        }
    }

    private fun convertId(raw: Any?, targetType: Class<*>): Any {
        require(raw != null) { "ID argument is required" }
        return when (targetType) {
            UUID::class.java -> when (raw) {
                is UUID -> raw
                else -> UUID.fromString(raw.toString())
            }
            Long::class.java, Long::class.javaPrimitiveType -> when (raw) {
                is Number -> raw.toLong()
                else -> raw.toString().toLong()
            }
            Int::class.java, Int::class.javaPrimitiveType -> when (raw) {
                is Number -> raw.toInt()
                else -> raw.toString().toInt()
            }
            Boolean::class.java, Boolean::class.javaPrimitiveType -> when (raw) {
                is Boolean -> raw
                else -> raw.toString().toBoolean()
            }
            else -> raw.toString()
        }
    }

    private fun safeJson(value: Any?): String =
        runCatching { objectMapper.writeValueAsString(value) }
            .getOrElse { "<unserializable: ${it.javaClass.simpleName}>" }
}

data class ProcessConfigurationExport(
    val filename: String,
    val content: String
)

@Service
class ProcessConfigurationExportService(
    private val crudService: JpaGraphQlCrudService,
    private val objectMapper: ObjectMapper
) {
    private val yamlMapper = YAMLMapper()
    private val yaml = Yaml(FilterEventRuleRepresenter(), DumperOptions().apply {
        defaultFlowStyle = DumperOptions.FlowStyle.BLOCK
        isPrettyFlow = true
        indent = 2
        indicatorIndent = 1
        defaultScalarStyle = DumperOptions.ScalarStyle.PLAIN
    })

    @Transactional(readOnly = true)
    fun exportProcessConfig(id: Any?, scheme: YamlImportScheme = YamlImportScheme.NEW): ProcessConfigurationExport {
        val processConfig = crudService.findProcessConfigForExport(id)
        val process = processConfig.process ?: error("ProcessConfig ${processConfig.id} does not contain process")
        val yamlTree = objectMapper.valueToTree<ObjectNode>(process).deepCopy()
        stripTechnicalFields(yamlTree)
        val exportTree = when (scheme) {
            YamlImportScheme.NEW -> yamlTree
            YamlImportScheme.LEGACY -> wrapLegacyProcess(transformToLegacyTree(yamlTree))
        }

        return ProcessConfigurationExport(
            filename = buildFilename(process),
            content = yaml.dump(asYamlValue(exportTree))
        )
    }

    private fun stripTechnicalFields(node: com.fasterxml.jackson.databind.JsonNode?) {
        when (node) {
            is ObjectNode -> {
                node.remove(listOf("createdAt", "updatedAt", "created_at", "updated_at"))
                val fields = node.fields()
                while (fields.hasNext()) {
                    stripTechnicalFields(fields.next().value)
                }
            }
            is ArrayNode -> {
                node.forEach(::stripTechnicalFields)
            }
        }
    }

    private fun buildFilename(process: Process): String {
        val rawName = process.contextCode?.code
            ?: process.nodeNameOrDescription()
            ?: process.id?.toString()
            ?: "process"
        val normalized = Normalizer.normalize(rawName, Normalizer.Form.NFKC)
            .replace(Regex("[^A-Za-z0-9._-]+"), "-")
            .trim('-')
            .ifBlank { "process" }
        return "$normalized.yaml"
    }

    private fun Process.nodeNameOrDescription(): String? =
        nodeName
            ?.trim()
            ?.takeIf { it.isNotEmpty() }
            ?: nodeComment
                ?.trim()
                ?.takeIf { it.isNotEmpty() }

    private fun wrapLegacyProcess(processNode: ObjectNode): ObjectNode =
        JsonNodeFactory.instance.objectNode().set<ObjectNode>("process", processNode)

    private fun transformToLegacyTree(node: ObjectNode): ObjectNode {
        val transformed = node.deepCopy()
        transformLegacyNode(transformed)
        return transformed
    }

    private fun transformLegacyNode(node: com.fasterxml.jackson.databind.JsonNode?) {
        when (node) {
            is ObjectNode -> {
                node.remove("id")
                node.remove("node_name")
                node.remove("nodeName")
                renameField(node, "duration_value", "durationValue")
                renameField(node, "duration_unit", "durationUnit")
                if (node.has("node_comment")) {
                    val description = node.get("node_comment")
                    node.remove("node_comment")
                    if (description != null && !description.isNull) {
                        node.set<com.fasterxml.jackson.databind.JsonNode>("description", description)
                    }
                }
                if (node.has("nodeComment")) {
                    val description = node.get("nodeComment")
                    node.remove("nodeComment")
                    if (!node.has("description") && description != null && !description.isNull) {
                        node.set<com.fasterxml.jackson.databind.JsonNode>("description", description)
                    }
                }
                node.fields().forEachRemaining { (_, value) ->
                    transformLegacyNode(value)
                }
            }
            is ArrayNode -> node.forEach(::transformLegacyNode)
        }
    }

    private fun renameField(node: ObjectNode, source: String, target: String) {
        if (!node.has(source)) {
            return
        }
        val value = node.get(source)
        node.remove(source)
        if (!node.has(target) && value != null && !value.isNull) {
            node.set<com.fasterxml.jackson.databind.JsonNode>(target, value)
        }
    }

    private fun asYamlValue(
        node: com.fasterxml.jackson.databind.JsonNode?,
        fieldName: String? = null,
        parentPath: List<String> = emptyList()
    ): Any? =
        when {
            node == null || node.isNull -> null
            node.isObject -> LinkedHashMap<String, Any?>().also { map ->
                node.fields().forEachRemaining { (name, value) ->
                    val yamlValue = asYamlValue(value, name, parentPath + name)
                    if (yamlValue != null) {
                        map[name] = yamlValue
                    }
                }
            }
            node.isArray -> node.map { asYamlValue(it, fieldName, parentPath) }
            node.isTextual -> {
                val text = node.textValue()
                if (requiresNullForBlank(parentPath, text)) {
                    null
                } else if (requiresLiteralStyle(fieldName, parentPath)) {
                    LiteralString(text)
                } else {
                    text
                }
            }
            node.isBoolean -> node.booleanValue()
            node.isIntegralNumber -> node.longValue()
            node.isFloatingPointNumber -> node.doubleValue()
            else -> yamlMapper.treeToValue(node, Any::class.java)
        }

    private fun requiresLiteralStyle(fieldName: String?, path: List<String>): Boolean =
        fieldName == "filter-event-rule" ||
            path.takeLast(2) == listOf("trigger", "rule") ||
            path.takeLast(2) == listOf("output", "rule")

    private fun requiresNullForBlank(path: List<String>, value: String): Boolean =
        value.isEmpty() && (
            path.takeLast(2) == listOf("service", "type") ||
                path.takeLast(2) == listOf("service", "status")
        )
}

private data class LiteralString(val value: String)

private class FilterEventRuleRepresenter : Representer(DumperOptions()) {
    init {
        representers[LiteralString::class.java] = LiteralStringRepresent()
    }

    private inner class LiteralStringRepresent : Represent {
        override fun representData(data: Any): Node =
            representScalar(Tag.STR, (data as LiteralString).value, DumperOptions.ScalarStyle.LITERAL)
    }
}

@Component
class JpaGraphQlRegistry(
    entityManagerFactory: EntityManagerFactory
) {
    lateinit var entities: Map<Class<*>, EntityMetadata>
    lateinit var embeddables: Map<Class<*>, ComplexTypeMetadata>
    lateinit var referenceInputs: Map<Class<*>, ReferenceInputMetadata>

    init {
        val metamodel = entityManagerFactory.metamodel
        val entityTypes = metamodel.entities
            .filter { !Modifier.isAbstract(it.javaType.modifiers) }
            .sortedBy { it.name }

        val embeddableClasses = linkedSetOf<Class<*>>()
        val builtEntities = linkedMapOf<Class<*>, EntityMetadata>()

        entityTypes.forEach { entityType ->
            builtEntities[entityType.javaType] = buildEntity(entityType, embeddableClasses)
        }

        val builtEmbeddables = linkedMapOf<Class<*>, ComplexTypeMetadata>()
        while (true) {
            val nextClass = embeddableClasses
                .firstOrNull { !builtEmbeddables.containsKey(it) }
                ?: break
            builtEmbeddables[nextClass] = buildEmbeddable(nextClass, embeddableClasses)
        }

        entities = builtEntities
        embeddables = builtEmbeddables
        referenceInputs = builtEntities.values.associate { entity ->
            entity.javaType to ReferenceInputMetadata(
                name = "${entity.name}RefInput",
                idField = entity.idField.name,
                idType = entity.idJavaType
            )
        }
    }

    fun entity(javaType: Class<*>): EntityMetadata =
        entities[javaType] ?: error("Entity metadata not found for ${javaType.name}")

    fun complexType(javaType: Class<*>): ComplexTypeMetadata =
        entities[javaType] ?: embeddables[javaType] ?: error("Complex type metadata not found for ${javaType.name}")

    private fun buildEntity(entityType: EntityType<*>, embeddableClasses: MutableSet<Class<*>>): EntityMetadata {
        val idField = findIdField(entityType.javaType)
        val fields = entityType.attributes
            .sortedBy { it.name }
            .map { buildEntityField(entityType, it, embeddableClasses) }

        return EntityMetadata(
            name = entityType.javaType.simpleName,
            inputName = "${entityType.javaType.simpleName}Input",
            javaType = entityType.javaType,
            jpaName = entityType.name,
            queryField = entityType.javaType.simpleName.replaceFirstChar { it.lowercase() },
            listField = "${entityType.javaType.simpleName.replaceFirstChar { it.lowercase() }}List",
            mutable = !entityType.javaType.isAnnotationPresent(Immutable::class.java),
            idField = idField,
            idJavaType = idField.type,
            fields = fields
        )
    }

    private fun buildEmbeddable(javaType: Class<*>, embeddableClasses: MutableSet<Class<*>>): ComplexTypeMetadata {
        val fields = allFields(javaType)
            .filterNot(::isStaticOrSynthetic)
            .sortedBy(Field::getName)
            .map { buildReflectionField(javaType, it, embeddableClasses) }

        return ComplexTypeMetadata(
            name = javaType.simpleName,
            inputName = "${javaType.simpleName}Input",
            javaType = javaType,
            fields = fields
        )
    }

    private fun buildEntityField(
        ownerType: EntityType<*>,
        attribute: Attribute<*, *>,
        embeddableClasses: MutableSet<Class<*>>
    ): FieldMetadata {
        val member = attribute.javaMember
        val fieldName = attribute.name
        val isId = hasAnnotation(member, Id::class.java)
        val metamodelJavaType = when (attribute) {
            is PluralAttribute<*, *, *> -> attribute.elementType.javaType
            else -> attribute.javaType
        }
        val targetJavaType = when (attribute) {
            is PluralAttribute<*, *, *> -> metamodelJavaType
            else -> declaredJavaType(member, metamodelJavaType)
        }

        if (isId) {
            return FieldMetadata(
                name = fieldName,
                kind = FieldKind.SCALAR,
                targetClass = targetJavaType,
                outputType = "ID",
                inputType = "ID",
                inverseField = null
            )
        }

        return when (attribute.persistentAttributeType) {
            Attribute.PersistentAttributeType.BASIC -> FieldMetadata(
                name = fieldName,
                kind = FieldKind.SCALAR,
                targetClass = targetJavaType,
                outputType = graphQlScalar(targetJavaType),
                inputType = graphQlScalar(targetJavaType),
                inverseField = null
            )
            Attribute.PersistentAttributeType.ELEMENT_COLLECTION -> FieldMetadata(
                name = fieldName,
                kind = FieldKind.SCALAR_COLLECTION,
                targetClass = targetJavaType,
                outputType = "[${graphQlScalar(targetJavaType)}!]",
                inputType = "[${graphQlScalar(targetJavaType)}!]",
                inverseField = null
            )
            Attribute.PersistentAttributeType.EMBEDDED -> {
                embeddableClasses += targetJavaType
                FieldMetadata(
                    name = fieldName,
                    kind = FieldKind.EMBEDDED,
                    targetClass = targetJavaType,
                    outputType = targetJavaType.simpleName,
                    inputType = "${targetJavaType.simpleName}Input",
                    inverseField = null
                )
            }
            Attribute.PersistentAttributeType.MANY_TO_ONE -> FieldMetadata(
                name = fieldName,
                kind = FieldKind.ENTITY_REFERENCE,
                targetClass = targetJavaType,
                outputType = targetJavaType.simpleName,
                inputType = "${targetJavaType.simpleName}RefInput",
                inverseField = null
            )
            Attribute.PersistentAttributeType.ONE_TO_MANY -> FieldMetadata(
                name = fieldName,
                kind = FieldKind.ENTITY_CHILD_COLLECTION,
                targetClass = targetJavaType,
                outputType = "[${targetJavaType.simpleName}!]",
                inputType = "[${targetJavaType.simpleName}Input!]",
                inverseField = findInverseField(targetJavaType, ownerType.javaType)
            )
            Attribute.PersistentAttributeType.ONE_TO_ONE -> {
                val nestedInput = includeOneToOneInInput(member)
                FieldMetadata(
                    name = fieldName,
                    kind = if (nestedInput) FieldKind.ENTITY_CHILD else FieldKind.ENTITY_REFERENCE,
                    targetClass = targetJavaType,
                    outputType = targetJavaType.simpleName,
                    inputType = if (nestedInput) "${targetJavaType.simpleName}Input" else null,
                    inverseField = if (nestedInput) findInverseField(targetJavaType, ownerType.javaType) else null
                )
            }
            else -> FieldMetadata(
                name = fieldName,
                kind = FieldKind.SCALAR,
                targetClass = targetJavaType,
                outputType = "String",
                inputType = "String",
                inverseField = null
            )
        }
    }

    private fun buildReflectionField(
        ownerType: Class<*>,
        field: Field,
        embeddableClasses: MutableSet<Class<*>>
    ): FieldMetadata {
        val javaType = field.type
        if (field.isAnnotationPresent(Embedded::class.java) || javaType.isAnnotationPresent(Embeddable::class.java)) {
            embeddableClasses += javaType
            return FieldMetadata(
                name = field.name,
                kind = FieldKind.EMBEDDED,
                targetClass = javaType,
                outputType = javaType.simpleName,
                inputType = "${javaType.simpleName}Input",
                inverseField = null
            )
        }

        if (field.isAnnotationPresent(ManyToOne::class.java)) {
            return FieldMetadata(
                name = field.name,
                kind = FieldKind.ENTITY_REFERENCE,
                targetClass = javaType,
                outputType = javaType.simpleName,
                inputType = "${javaType.simpleName}RefInput",
                inverseField = null
            )
        }

        if (field.isAnnotationPresent(OneToOne::class.java)) {
            val nestedInput = includeOneToOneInInput(field)
            return FieldMetadata(
                name = field.name,
                kind = if (nestedInput) FieldKind.ENTITY_CHILD else FieldKind.ENTITY_REFERENCE,
                targetClass = javaType,
                outputType = javaType.simpleName,
                inputType = if (nestedInput) "${javaType.simpleName}Input" else null,
                inverseField = if (nestedInput) findInverseField(javaType, ownerType) else null
            )
        }

        if (field.isAnnotationPresent(OneToMany::class.java) || field.isAnnotationPresent(ElementCollection::class.java)) {
            return FieldMetadata(
                name = field.name,
                kind = FieldKind.SCALAR_COLLECTION,
                targetClass = String::class.java,
                outputType = "[String!]",
                inputType = "[String!]",
                inverseField = null
            )
        }

        return FieldMetadata(
            name = field.name,
            kind = FieldKind.SCALAR,
            targetClass = javaType,
            outputType = graphQlScalar(javaType),
            inputType = graphQlScalar(javaType),
            inverseField = null
        )
    }

    private fun includeOneToOneInInput(member: Member): Boolean {
        val annotation = annotation(member, OneToOne::class.java) ?: return false
        return annotation.orphanRemoval || annotation.cascade.any {
            it == jakarta.persistence.CascadeType.ALL ||
                it == jakarta.persistence.CascadeType.PERSIST ||
                it == jakarta.persistence.CascadeType.MERGE
        }
    }

    private fun findInverseField(targetType: Class<*>, ownerType: Class<*>): String? =
        allFields(targetType)
            .firstOrNull { field ->
                !isStaticOrSynthetic(field) &&
                    (field.isAnnotationPresent(ManyToOne::class.java) || field.isAnnotationPresent(OneToOne::class.java)) &&
                    field.type == ownerType
            }
            ?.name

    private fun declaredJavaType(member: Member, fallback: Class<*>): Class<*> = when (member) {
        is Field -> member.type
        is Method -> member.returnType
        else -> fallback
    }

    private fun graphQlScalar(javaType: Class<*>): String = when (javaType) {
        Boolean::class.java, Boolean::class.javaPrimitiveType -> "Boolean"
        Int::class.java, Int::class.javaPrimitiveType,
        Short::class.java, Short::class.javaPrimitiveType -> "Int"
        Float::class.java, Float::class.javaPrimitiveType,
        Double::class.java, Double::class.javaPrimitiveType,
        java.math.BigDecimal::class.java -> "Float"
        Long::class.java, Long::class.javaPrimitiveType -> "String"
        else -> "String"
    }

    private fun findIdField(javaType: Class<*>): Field =
        allFields(javaType).firstOrNull { it.isAnnotationPresent(Id::class.java) }
            ?: error("Entity ${javaType.name} does not have @Id field")

    private fun allFields(javaType: Class<*>): List<Field> {
        val fields = mutableListOf<Field>()
        var current: Class<*>? = javaType
        while (current != null && current != Any::class.java) {
            fields += current.declaredFields
            current = current.superclass
        }
        return fields
    }

    private fun isStaticOrSynthetic(field: Field): Boolean = field.isSynthetic || Modifier.isStatic(field.modifiers)

    private fun <A : Annotation> hasAnnotation(member: Member, type: Class<A>): Boolean = annotation(member, type) != null

    private fun <A : Annotation> annotation(member: Member, type: Class<A>): A? = when (member) {
        is Field -> member.getAnnotation(type)
        is java.lang.reflect.Method -> member.getAnnotation(type)
        else -> null
    }
}

open class ComplexTypeMetadata(
    val name: String,
    val inputName: String,
    val javaType: Class<*>,
    val fields: List<FieldMetadata>
)

class EntityMetadata(
    name: String,
    inputName: String,
    javaType: Class<*>,
    val jpaName: String,
    val queryField: String,
    val listField: String,
    val mutable: Boolean,
    val idField: Field,
    val idJavaType: Class<*>,
    fields: List<FieldMetadata>
) : ComplexTypeMetadata(name, inputName, javaType, fields)

data class ReferenceInputMetadata(
    val name: String,
    val idField: String,
    val idType: Class<*>
)

data class FieldMetadata(
    val name: String,
    val kind: FieldKind,
    val targetClass: Class<*>,
    val outputType: String,
    val inputType: String?,
    val inverseField: String?
)

enum class FieldKind {
    SCALAR,
    SCALAR_COLLECTION,
    EMBEDDED,
    ENTITY_REFERENCE,
    ENTITY_CHILD,
    ENTITY_CHILD_COLLECTION
}

private fun getFieldValue(target: Any, fieldName: String): Any? {
    val field = findField(target.javaClass, fieldName)
    field.isAccessible = true
    return field.get(target)
}

private fun setFieldValue(target: Any, fieldName: String, value: Any?) {
    val field = findField(target.javaClass, fieldName)
    field.isAccessible = true
    field.set(target, value)
}

private fun instantiateReference(target: EntityMetadata, id: Any): Any {
    val instance = target.javaType.getDeclaredConstructor().newInstance()
    setFieldValue(instance, target.idField.name, id)
    return instance
}

private fun instantiateDictionaryReference(referenceJavaType: Class<*>, code: Any): Any {
    val instance = referenceJavaType.getDeclaredConstructor().newInstance()
    setFieldValue(instance, "code", code.toString())
    return instance
}

private fun findField(javaType: Class<*>, fieldName: String): Field {
    var current: Class<*>? = javaType
    while (current != null && current != Any::class.java) {
        runCatching { current.getDeclaredField(fieldName) }.getOrNull()?.let { return it }
        current = current.superclass
    }
    error("Field $fieldName not found in ${javaType.name}")
}
