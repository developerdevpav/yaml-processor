package com.sber.yamlprocessor.graphql

import com.fasterxml.jackson.databind.ObjectMapper
import com.sber.yamlprocessor.jsonlogic.JsonLogicFormattingService
import com.sber.yamlprocessor.model.ContextCodesDictionary
import com.sber.yamlprocessor.model.Process
import com.sber.yamlprocessor.model.Stage
import com.sber.yamlprocessor.model.Subprocess
import jakarta.persistence.EntityManager
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Service
class ProcessNodeGraphQlService(
    private val entityManager: EntityManager,
    private val objectMapper: ObjectMapper,
    private val registry: JpaGraphQlRegistry,
    private val idConverter: GraphQlIdConverter,
    private val graphInitializer: JpaGraphQlEntityGraphInitializer,
    private val entityMapper: JpaGraphQlEntityMapper,
    private val jsonLogicFormattingService: JsonLogicFormattingService
) {
    private val logger = LoggerFactory.getLogger(ProcessNodeGraphQlService::class.java)

    @Transactional
    fun updateStage(id: Any?, input: Map<String, Any?>): Stage {
        val entity = registry.entity(Stage::class.java)
        val entityId = idConverter.convert(id, entity.idJavaType)
        val current = entityManager.find(Stage::class.java, entityId)
            ?: error("Stage with id=$entityId not found")
        logger.info(
            "updateStageNode start: stageId={}, currentConfiguratorId={}, currentSubprocessId={}, input={}",
            entityId,
            current.configurator?.id,
            current.subprocess?.id,
            entityMapper.safeJson(input)
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
            current.contextCode = contextCodeReference(input["contextCode"])
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

        entityMapper.sanitize(current, entity)

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
        graphInitializer.initialize(merged, entity)
        return merged as Stage
    }

    @Transactional
    fun createSubprocess(processId: Any?, input: Map<String, Any?>): Subprocess {
        val parentId = idConverter.convert(processId, UUID::class.java)
        val process = entityManager.find(Process::class.java, parentId)
            ?: error("Process with id=$parentId not found")
        val entity = registry.entity(Subprocess::class.java)
        val subprocess = objectMapper.convertValue(input, Subprocess::class.java)
        entityMapper.coerceReferenceFields(subprocess, input, entity)
        subprocess.trigger.rule = jsonLogicFormattingService.format(subprocess.trigger.rule)
        subprocess.process = process
        entityMapper.sanitize(subprocess, entity)
        process.subprocess.add(subprocess)
        entityManager.persist(subprocess)
        entityManager.flush()
        graphInitializer.initialize(subprocess, entity)
        return subprocess
    }

    @Transactional
    fun updateSubprocess(id: Any?, input: Map<String, Any?>): Subprocess {
        val entity = registry.entity(Subprocess::class.java)
        val entityId = idConverter.convert(id, entity.idJavaType)
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
            current.trigger.rule = jsonLogicFormattingService.format(triggerInput?.get("rule")?.toString())
        }

        entityManager.flush()
        graphInitializer.initialize(current, entity)
        return current
    }

    @Transactional
    fun reorderSubprocessStages(subprocessId: Any?, stageIds: List<Any?>): Subprocess {
        val entity = registry.entity(Subprocess::class.java)
        val entityId = idConverter.convert(subprocessId, entity.idJavaType)
        val current = entityManager.find(Subprocess::class.java, entityId)
            ?: error("Subprocess with id=$entityId not found")

        val currentStages = current.stages.toList()
        val currentStageIds = currentStages.mapNotNull { it.id }
        val requestedStageIds = stageIds.map { idConverter.convert(it, UUID::class.java) as UUID }

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
        graphInitializer.initialize(current, entity)
        return current
    }

    @Transactional
    fun deleteSubprocess(id: Any?): Boolean {
        val entityId = idConverter.convert(id, UUID::class.java)
        val subprocess = entityManager.find(Subprocess::class.java, entityId) ?: return false
        subprocess.process?.subprocess?.removeIf { it.id == subprocess.id }
        entityManager.flush()
        return true
    }

    @Transactional
    fun createStage(subprocessId: Any?, input: Map<String, Any?>): Stage {
        val parentId = idConverter.convert(subprocessId, UUID::class.java)
        val subprocess = entityManager.find(Subprocess::class.java, parentId)
            ?: error("Subprocess with id=$parentId not found")
        val entity = registry.entity(Stage::class.java)
        val stage = objectMapper.convertValue(input, Stage::class.java)
        entityMapper.coerceReferenceFields(stage, input, entity)
        stage.subprocess = subprocess
        entityMapper.sanitize(stage, entity)
        subprocess.stages.add(stage)
        entityManager.persist(stage)
        entityManager.flush()
        graphInitializer.initialize(stage, entity)
        return stage
    }

    @Transactional
    fun updateProcess(id: Any?, input: Map<String, Any?>): Process {
        val entity = registry.entity(Process::class.java)
        val entityId = idConverter.convert(id, entity.idJavaType)
        val current = entityManager.find(Process::class.java, entityId)
            ?: error("Process with id=$entityId not found")

        if (input.containsKey("nodeName")) {
            current.nodeName = input["nodeName"]?.toString()?.ifBlank { null }
        }
        if (input.containsKey("nodeComment")) {
            current.nodeComment = input["nodeComment"]?.toString()?.ifBlank { null }
        }
        if (input.containsKey("contextCode")) {
            current.contextCode = contextCodeReference(input["contextCode"])
        }

        entityManager.flush()
        graphInitializer.initialize(current, entity)
        return current
    }

    @Transactional
    fun deleteStage(id: Any?): Boolean {
        val entityId = idConverter.convert(id, UUID::class.java)
        val stage = entityManager.find(Stage::class.java, entityId) ?: return false
        stage.subprocess?.stages?.removeIf { it.id == stage.id }
        entityManager.flush()
        return true
    }

    private fun contextCodeReference(input: Any?): ContextCodesDictionary? {
        @Suppress("UNCHECKED_CAST")
        val contextInput = input as Map<String, Any?>?
        val contextCode = contextInput?.get("code")?.toString()?.trim().orEmpty()
        return if (contextCode.isBlank()) {
            null
        } else {
            entityManager.getReference(ContextCodesDictionary::class.java, contextCode)
        }
    }
}
