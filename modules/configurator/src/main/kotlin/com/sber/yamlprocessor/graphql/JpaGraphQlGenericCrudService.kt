package com.sber.yamlprocessor.graphql

import com.fasterxml.jackson.databind.ObjectMapper
import com.sber.yamlprocessor.model.ProcessConfig
import jakarta.persistence.EntityManager
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class JpaGraphQlGenericCrudService(
    private val entityManager: EntityManager,
    private val objectMapper: ObjectMapper,
    private val registry: JpaGraphQlRegistry,
    private val idConverter: GraphQlIdConverter,
    private val graphInitializer: JpaGraphQlEntityGraphInitializer,
    private val entityMapper: JpaGraphQlEntityMapper
) {
    @Transactional(readOnly = true)
    fun findProcessConfigForExport(id: Any?): ProcessConfig {
        val entity = registry.entity(ProcessConfig::class.java)
        val entityId = idConverter.convert(id, entity.idJavaType)
        val config = entityManager.find(ProcessConfig::class.java, entityId)
            ?: error("ProcessConfig with id=$entityId not found")
        graphInitializer.initialize(config, entity)
        return config
    }

    @Transactional(readOnly = true)
    fun findById(entity: EntityMetadata, id: Any?): Any? =
        entityManager.find(entity.javaType, idConverter.convert(id, entity.idJavaType))
            ?.also { graphInitializer.initialize(it, entity) }

    @Transactional(readOnly = true)
    fun findAll(entity: EntityMetadata): List<Any> =
        entityManager.createQuery("select e from ${entity.jpaName} e", entity.javaType)
            .resultList
            .map { it as Any }
            .onEach { graphInitializer.initialize(it, entity) }

    @Transactional
    fun create(entity: EntityMetadata, input: Map<String, Any?>): Any {
        val instance = objectMapper.convertValue(input, entity.javaType)
        entityMapper.coerceReferenceFields(instance, input, entity)
        entityMapper.sanitize(instance, entity)
        entityManager.persist(instance)
        entityManager.flush()
        graphInitializer.initialize(instance, entity)
        return instance
    }

    @Transactional
    fun update(entity: EntityMetadata, id: Any?, input: Map<String, Any?>): Any {
        val entityId = idConverter.convert(id, entity.idJavaType)
        val current = entityManager.find(entity.javaType, entityId)
            ?: error("${entity.name} with id=$entityId not found")
        val instance = objectMapper.convertValue(input, entity.javaType)
        entityMapper.coerceReferenceFields(instance, input, entity)
        setFieldValue(instance, entity.idField.name, entityId)
        entityMapper.alignChildIdentifiers(current, instance, entity)
        entityMapper.sanitize(instance, entity)
        val merged = entityManager.merge(instance)
        entityManager.flush()
        graphInitializer.initialize(merged, entity)
        return merged
    }

    @Transactional
    fun delete(entity: EntityMetadata, id: Any?): Boolean {
        val managed = entityManager.find(entity.javaType, idConverter.convert(id, entity.idJavaType)) ?: return false
        entityManager.remove(managed)
        entityManager.flush()
        return true
    }
}
