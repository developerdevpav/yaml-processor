package com.sber.yamlprocessor.graphql

import com.fasterxml.jackson.databind.ObjectMapper
import com.sber.yamlprocessor.model.Configurator
import com.sber.yamlprocessor.model.ContextCodesDictionary
import com.sber.yamlprocessor.model.Process
import com.sber.yamlprocessor.model.ProcessConfig
import com.sber.yamlprocessor.model.Result
import com.sber.yamlprocessor.model.Reverse
import com.sber.yamlprocessor.model.ReverseOutput
import com.sber.yamlprocessor.model.Stage
import com.sber.yamlprocessor.model.Subprocess
import jakarta.persistence.EntityManager
import org.hibernate.Hibernate
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.Collections
import java.util.IdentityHashMap
import java.util.UUID
import kotlin.reflect.jvm.kotlinProperty

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
    fun reorderReverseOutputs(reverseId: Any?, outputIds: List<Any?>): Reverse {
        val entity = registry.entity(Reverse::class.java)
        val entityId = convertId(reverseId, entity.idJavaType)
        val current = entityManager.find(Reverse::class.java, entityId)
            ?: error("Reverse with id=$entityId not found")

        val currentOutputs = current.output.toList()
        val currentOutputIds = currentOutputs.mapNotNull { it.id }
        val requestedOutputIds = outputIds.map { convertId(it, UUID::class.java) as UUID }

        require(requestedOutputIds.size == currentOutputs.size) {
            "Expected ${currentOutputs.size} output ids for reverse $entityId, got ${requestedOutputIds.size}"
        }
        require(requestedOutputIds.distinct().size == requestedOutputIds.size) {
            "Output ids for reverse $entityId must be unique"
        }
        require(currentOutputIds.toSet() == requestedOutputIds.toSet()) {
            "Output ids do not match reverse $entityId current outputs"
        }

        val outputById = currentOutputs.associateBy { it.id }
        requestedOutputIds.forEachIndexed { index, outputId ->
            current.output[index] = outputById.getValue(outputId)
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
        if (entity.javaType == ContextCodesDictionary::class.java) {
            return deleteContextCodesDictionary(id)
        }

        val managed = entityManager.find(entity.javaType, convertId(id, entity.idJavaType)) ?: return false
        entityManager.remove(managed)
        entityManager.flush()
        return true
    }

    private fun deleteContextCodesDictionary(id: Any?): Boolean {
        val code = id?.toString()?.trim().orEmpty()
        require(code.isNotBlank()) { "Context code id must not be blank" }

        val current = entityManager.find(ContextCodesDictionary::class.java, code) ?: return false
        val processUsageCount = countContextCodeProcessUsage(code)
        val stageUsageCount = countContextCodeStageUsage(code)
        require(processUsageCount == 0L && stageUsageCount == 0L) {
            "Код процесса \"$code\" используется: процессов $processUsageCount, стадий $stageUsageCount."
        }

        entityManager.remove(current)
        entityManager.flush()
        return true
    }

    private fun countContextCodeProcessUsage(code: String): Long =
        entityManager.createQuery(
            "select count(p) from Process p where p.contextCode.code = :code",
            java.lang.Long::class.java
        )
            .setParameter("code", code)
            .singleResult.toLong()

    private fun countContextCodeStageUsage(code: String): Long =
        entityManager.createQuery(
            "select count(s) from Stage s where s.contextCode.code = :code",
            java.lang.Long::class.java
        )
            .setParameter("code", code)
            .singleResult.toLong()

    @Transactional
    fun renameContextCodesDictionary(id: Any?, code: String): ContextCodesDictionary {
        val currentCode = id?.toString()?.trim().orEmpty()
        val nextCode = code.trim()

        require(currentCode.isNotBlank()) { "Context code id must not be blank" }
        require(nextCode.isNotBlank()) { "Context code must not be blank" }
        require(nextCode.length <= 64) { "Context code must be 64 characters or less" }

        val current = entityManager.find(ContextCodesDictionary::class.java, currentCode)
            ?: error("ContextCodesDictionary with code=$currentCode not found")

        if (currentCode == nextCode) {
            return current
        }

        require(entityManager.find(ContextCodesDictionary::class.java, nextCode) == null) {
            "ContextCodesDictionary with code=$nextCode already exists"
        }

        val replacement = ContextCodesDictionary(code = nextCode)
        entityManager.persist(replacement)
        entityManager.flush()

        entityManager.createQuery(
            "update Process p set p.contextCode = :replacement where p.contextCode = :current"
        )
            .setParameter("replacement", replacement)
            .setParameter("current", current)
            .executeUpdate()
        entityManager.createQuery(
            "update Stage s set s.contextCode = :replacement where s.contextCode = :current"
        )
            .setParameter("replacement", replacement)
            .setParameter("current", current)
            .executeUpdate()

        entityManager.flush()
        entityManager.clear()

        entityManager.find(ContextCodesDictionary::class.java, currentCode)?.let(entityManager::remove)
        entityManager.flush()
        entityManager.clear()

        return entityManager.find(ContextCodesDictionary::class.java, nextCode)
            ?: error("ContextCodesDictionary with code=$nextCode not found after rename")
    }

    private fun sanitize(value: Any?, type: ComplexTypeMetadata) {
        if (value == null) {
            return
        }

        type.fields.forEach { field ->
            val current = getFieldValue(value, field.name) ?: return@forEach
            if (field.kind == FieldKind.SCALAR &&
                field.targetClass == String::class.java &&
                current is String &&
                current.isBlank() &&
                isNullableStringField(value.javaClass, field.name)
            ) {
                setFieldValue(value, field.name, null)
                return@forEach
            }
            when (field.kind) {
                FieldKind.SCALAR, FieldKind.SCALAR_COLLECTION -> Unit
                FieldKind.EMBEDDED -> sanitize(current, registry.complexType(field.targetClass))
                FieldKind.ENTITY_REFERENCE -> {
                    val referenceField = findField(value.javaClass, field.name)
                    val referenceJavaType = referenceField.type
                    val target = registry.entity(referenceJavaType)
                    val refId = referenceIdentifier(current, target)
                    if (refId == null) {
                        if (isInMemoryBackReference(current, value, target)) {
                            return@forEach
                        }
                        error("Reference ${field.name} must include ${target.idField.name}")
                    }
                    val normalizedReference = entityManager.getReference(
                        referenceJavaType,
                        convertId(refId, target.idJavaType)
                    )
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
                    val normalizedReference = entityManager.getReference(
                        referenceJavaType,
                        convertId(refId, target.idJavaType)
                    )
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

    private fun referenceIdentifier(reference: Any, target: EntityMetadata): Any? =
        runCatching { entityManager.entityManagerFactory.persistenceUnitUtil.getIdentifier(reference) }
            .getOrNull()
            ?: getFieldValue(reference, target.idField.name)

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

    private fun isNullableStringField(javaType: Class<*>, fieldName: String): Boolean =
        findField(javaType, fieldName).kotlinProperty?.returnType?.isMarkedNullable == true
}
