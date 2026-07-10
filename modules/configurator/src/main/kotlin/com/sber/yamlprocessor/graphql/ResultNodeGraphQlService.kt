package com.sber.yamlprocessor.graphql

import com.fasterxml.jackson.databind.ObjectMapper
import com.sber.yamlprocessor.jsonlogic.JsonLogicFormattingService
import com.sber.yamlprocessor.model.Configurator
import com.sber.yamlprocessor.model.Result
import com.sber.yamlprocessor.model.Reverse
import com.sber.yamlprocessor.model.ReverseOutput
import jakarta.persistence.EntityManager
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Service
class ResultNodeGraphQlService(
    private val entityManager: EntityManager,
    private val objectMapper: ObjectMapper,
    private val registry: JpaGraphQlRegistry,
    private val idConverter: GraphQlIdConverter,
    private val graphInitializer: JpaGraphQlEntityGraphInitializer,
    private val entityMapper: JpaGraphQlEntityMapper,
    private val jsonLogicFormattingService: JsonLogicFormattingService
) {
    @Transactional
    fun createResult(configuratorId: Any?, input: Map<String, Any?>): Result {
        val parentId = idConverter.convert(configuratorId, UUID::class.java)
        val configurator = entityManager.find(Configurator::class.java, parentId)
            ?: error("Configurator with id=$parentId not found")
        val entity = registry.entity(Result::class.java)
        val result = objectMapper.convertValue(input, Result::class.java)
        entityMapper.coerceReferenceFields(result, input, entity)
        result.configurator = configurator
        entityMapper.sanitize(result, entity)
        configurator.result.add(result)
        entityManager.persist(result)
        entityManager.flush()
        graphInitializer.initialize(result, entity)
        return result
    }

    @Transactional
    fun updateResult(id: Any?, input: Map<String, Any?>): Result {
        val entity = registry.entity(Result::class.java)
        val entityId = idConverter.convert(id, entity.idJavaType)
        val current = entityManager.find(Result::class.java, entityId)
            ?: error("Result with id=$entityId not found")
        val incoming = objectMapper.convertValue(input, Result::class.java)
        entityMapper.coerceReferenceFields(incoming, input, entity)
        setFieldValue(incoming, entity.idField.name, entityId)
        incoming.configurator = current.configurator
        entityMapper.alignChildIdentifiers(current, incoming, entity)
        entityMapper.sanitize(incoming, entity)
        val merged = entityManager.merge(incoming)
        entityManager.flush()
        graphInitializer.initialize(merged, entity)
        return merged as Result
    }

    @Transactional
    fun deleteResult(id: Any?): Boolean {
        val entityId = idConverter.convert(id, UUID::class.java)
        val result = entityManager.find(Result::class.java, entityId) ?: return false
        result.configurator?.result?.removeIf { it.id == result.id }
        entityManager.flush()
        return true
    }

    @Transactional
    fun createReverse(resultId: Any?, input: Map<String, Any?>): Reverse {
        val parentId = idConverter.convert(resultId, UUID::class.java)
        val result = entityManager.find(Result::class.java, parentId)
            ?: error("Result with id=$parentId not found")
        val entity = registry.entity(Reverse::class.java)
        val reverse = objectMapper.convertValue(input, Reverse::class.java)
        entityMapper.coerceReferenceFields(reverse, input, entity)
        reverse.result = result
        entityMapper.sanitize(reverse, entity)
        result.reverse.add(reverse)
        entityManager.persist(reverse)
        entityManager.flush()
        graphInitializer.initialize(reverse, entity)
        return reverse
    }

    @Transactional
    fun updateReverse(id: Any?, input: Map<String, Any?>): Reverse {
        val entity = registry.entity(Reverse::class.java)
        val entityId = idConverter.convert(id, entity.idJavaType)
        val current = entityManager.find(Reverse::class.java, entityId)
            ?: error("Reverse with id=$entityId not found")
        val incoming = objectMapper.convertValue(input, Reverse::class.java)
        entityMapper.coerceReferenceFields(incoming, input, entity)
        setFieldValue(incoming, entity.idField.name, entityId)
        incoming.result = current.result
        entityMapper.alignChildIdentifiers(current, incoming, entity)
        entityMapper.sanitize(incoming, entity)
        val merged = entityManager.merge(incoming)
        entityManager.flush()
        graphInitializer.initialize(merged, entity)
        return merged as Reverse
    }

    @Transactional
    fun deleteReverse(id: Any?): Boolean {
        val entityId = idConverter.convert(id, UUID::class.java)
        val reverse = entityManager.find(Reverse::class.java, entityId) ?: return false
        reverse.result?.reverse?.removeIf { it.id == reverse.id }
        entityManager.flush()
        return true
    }

    @Transactional
    fun reorderReverseOutputs(reverseId: Any?, outputIds: List<Any?>): Reverse {
        val entity = registry.entity(Reverse::class.java)
        val entityId = idConverter.convert(reverseId, entity.idJavaType)
        val current = entityManager.find(Reverse::class.java, entityId)
            ?: error("Reverse with id=$entityId not found")

        val currentOutputs = current.output.toList()
        val currentOutputIds = currentOutputs.mapNotNull { it.id }
        val requestedOutputIds = outputIds.map { idConverter.convert(it, UUID::class.java) as UUID }

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
        graphInitializer.initialize(current, entity)
        return current
    }

    @Transactional
    fun createReverseOutput(reverseId: Any?, input: Map<String, Any?>): ReverseOutput {
        val parentId = idConverter.convert(reverseId, UUID::class.java)
        val reverse = entityManager.find(Reverse::class.java, parentId)
            ?: error("Reverse with id=$parentId not found")
        val entity = registry.entity(ReverseOutput::class.java)
        val output = objectMapper.convertValue(input, ReverseOutput::class.java)
        entityMapper.coerceReferenceFields(output, input, entity)
        output.rule = jsonLogicFormattingService.format(output.rule).ifBlank { null }
        output.reverse = reverse
        entityMapper.sanitize(output, entity)
        reverse.output.add(output)
        entityManager.persist(output)
        entityManager.flush()
        graphInitializer.initialize(output, entity)
        return output
    }

    @Transactional
    fun updateReverseOutput(id: Any?, input: Map<String, Any?>): ReverseOutput {
        val entity = registry.entity(ReverseOutput::class.java)
        val entityId = idConverter.convert(id, entity.idJavaType)
        val current = entityManager.find(ReverseOutput::class.java, entityId)
            ?: error("ReverseOutput with id=$entityId not found")
        val incoming = objectMapper.convertValue(input, ReverseOutput::class.java)
        entityMapper.coerceReferenceFields(incoming, input, entity)
        incoming.rule = jsonLogicFormattingService.format(incoming.rule).ifBlank { null }
        setFieldValue(incoming, entity.idField.name, entityId)
        incoming.reverse = current.reverse
        entityMapper.alignChildIdentifiers(current, incoming, entity)
        entityMapper.sanitize(incoming, entity)
        val merged = entityManager.merge(incoming)
        entityManager.flush()
        graphInitializer.initialize(merged, entity)
        return merged as ReverseOutput
    }

    @Transactional
    fun deleteReverseOutput(id: Any?): Boolean {
        val entityId = idConverter.convert(id, UUID::class.java)
        val output = entityManager.find(ReverseOutput::class.java, entityId) ?: return false
        output.reverse?.output?.removeIf { it.id == output.id }
        entityManager.flush()
        return true
    }
}
