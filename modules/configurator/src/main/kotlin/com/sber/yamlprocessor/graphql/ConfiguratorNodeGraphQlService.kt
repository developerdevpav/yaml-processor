package com.sber.yamlprocessor.graphql

import com.fasterxml.jackson.databind.ObjectMapper
import com.sber.yamlprocessor.jsonlogic.JsonLogicFormattingService
import com.sber.yamlprocessor.model.Configurator
import com.sber.yamlprocessor.model.Stage
import jakarta.persistence.EntityManager
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Service
class ConfiguratorNodeGraphQlService(
    private val entityManager: EntityManager,
    private val objectMapper: ObjectMapper,
    private val registry: JpaGraphQlRegistry,
    private val idConverter: GraphQlIdConverter,
    private val graphInitializer: JpaGraphQlEntityGraphInitializer,
    private val entityMapper: JpaGraphQlEntityMapper,
    private val jsonLogicFormattingService: JsonLogicFormattingService
) {
    private val logger = LoggerFactory.getLogger(ConfiguratorNodeGraphQlService::class.java)

    @Transactional
    fun create(stageId: Any?, input: Map<String, Any?>): Configurator {
        val parentId = idConverter.convert(stageId, UUID::class.java)
        val stage = entityManager.find(Stage::class.java, parentId)
            ?: error("Stage with id=$parentId not found")
        require(stage.configurator == null) { "Stage with id=$parentId already has configurator" }

        val entity = registry.entity(Configurator::class.java)
        val configurator = objectMapper.convertValue(input, Configurator::class.java)
        entityMapper.coerceReferenceFields(configurator, input, entity)
        configurator.filterEventRule = jsonLogicFormattingService.format(configurator.filterEventRule)
        configurator.stage = stage
        entityMapper.sanitize(configurator, entity)
        entityManager.persist(configurator)
        stage.configurator = configurator
        entityManager.flush()
        graphInitializer.initialize(configurator, entity)
        return configurator
    }

    @Transactional
    fun update(id: Any?, input: Map<String, Any?>): Configurator {
        val entity = registry.entity(Configurator::class.java)
        val entityId = idConverter.convert(id, entity.idJavaType)
        val current = entityManager.find(Configurator::class.java, entityId)
            ?: error("Configurator with id=$entityId not found")
        logger.info(
            "updateConfiguratorNode start: configuratorId={}, currentStageId={}, input={}",
            entityId,
            current.stage?.id,
            entityMapper.safeJson(input)
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
            current.filterEventRule = jsonLogicFormattingService.format(input["filterEventRule"]?.toString())
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
        entityMapper.sanitize(current, entity)
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
        graphInitializer.initialize(merged, entity)
        return merged as Configurator
    }

    @Transactional
    fun delete(id: Any?): Boolean {
        val entityId = idConverter.convert(id, UUID::class.java)
        val configurator = entityManager.find(Configurator::class.java, entityId) ?: return false
        configurator.stage?.configurator = null
        entityManager.remove(configurator)
        entityManager.flush()
        return true
    }
}
