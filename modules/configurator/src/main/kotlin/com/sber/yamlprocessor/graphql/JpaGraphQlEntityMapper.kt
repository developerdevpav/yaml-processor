package com.sber.yamlprocessor.graphql

import com.fasterxml.jackson.databind.ObjectMapper
import jakarta.persistence.EntityManager
import org.springframework.stereotype.Component
import kotlin.reflect.jvm.kotlinProperty

@Component
class JpaGraphQlEntityMapper(
    private val entityManager: EntityManager,
    private val objectMapper: ObjectMapper,
    private val registry: JpaGraphQlRegistry,
    private val idConverter: GraphQlIdConverter
) {
    fun sanitize(value: Any?, type: ComplexTypeMetadata) {
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
                FieldKind.ENTITY_REFERENCE -> normalizeReference(value, field, current)
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

    fun coerceReferenceFields(value: Any?, input: Map<String, Any?>, type: ComplexTypeMetadata) {
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
                FieldKind.ENTITY_REFERENCE -> coerceReferenceField(value, field, rawFieldValue)
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

    fun alignChildIdentifiers(current: Any?, incoming: Any?, type: ComplexTypeMetadata) {
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
                FieldKind.ENTITY_CHILD_COLLECTION -> alignChildCollectionIdentifiers(
                    currentValue,
                    incomingValue,
                    registry.entity(field.targetClass)
                )
            }
        }
    }

    fun safeJson(value: Any?): String =
        runCatching { objectMapper.writeValueAsString(value) }
            .getOrElse { "<unserializable: ${it.javaClass.simpleName}>" }

    private fun normalizeReference(owner: Any, field: FieldMetadata, current: Any) {
        val referenceField = findField(owner.javaClass, field.name)
        val referenceJavaType = referenceField.type
        val target = registry.entity(referenceJavaType)
        val refId = referenceIdentifier(current, target)
        if (refId == null) {
            if (isInMemoryBackReference(current, owner, target)) {
                return
            }
            error("Reference ${field.name} must include ${target.idField.name}")
        }
        val normalizedReference = entityManager.getReference(
            referenceJavaType,
            idConverter.convert(refId, target.idJavaType)
        )
        setFieldValue(owner, field.name, normalizedReference)
    }

    private fun coerceReferenceField(owner: Any, field: FieldMetadata, rawFieldValue: Any?) {
        @Suppress("UNCHECKED_CAST")
        val refInput = rawFieldValue as? Map<String, Any?> ?: return
        val referenceField = findField(owner.javaClass, field.name)
        val referenceJavaType = referenceField.type
        val target = registry.entity(referenceJavaType)
        val refId = refInput[target.idField.name] ?: return
        val normalizedReference = entityManager.getReference(
            referenceJavaType,
            idConverter.convert(refId, target.idJavaType)
        )
        setFieldValue(owner, field.name, normalizedReference)
    }

    private fun alignChildCollectionIdentifiers(
        currentValue: Any,
        incomingValue: Any,
        childType: EntityMetadata
    ) {
        val currentItems = (currentValue as? Iterable<*>)?.toList().orEmpty()
        val incomingItems = (incomingValue as? Iterable<*>)?.toList().orEmpty()
        incomingItems.forEachIndexed { index, child ->
            val existingChild = currentItems.getOrNull(index) ?: return@forEachIndexed
            if (child != null) {
                alignChildIdentifiers(existingChild, child, childType)
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

    private fun isNullableStringField(javaType: Class<*>, fieldName: String): Boolean =
        findField(javaType, fieldName).kotlinProperty?.returnType?.isMarkedNullable == true
}
