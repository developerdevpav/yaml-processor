package com.sber.yamlprocessor.mcp

import com.fasterxml.jackson.databind.JsonNode
import com.sber.yamlprocessor.graphql.ComplexTypeMetadata
import com.sber.yamlprocessor.graphql.FieldKind
import com.sber.yamlprocessor.graphql.EntityMetadata
import com.sber.yamlprocessor.graphql.JpaGraphQlRegistry
import jakarta.persistence.EntityManagerFactory
import org.hibernate.Hibernate
import org.springframework.stereotype.Component
import java.time.temporal.TemporalAccessor
import java.util.Collections
import java.util.IdentityHashMap

@Component
class JpaMcpResultMapper(
    private val registry: JpaGraphQlRegistry,
    private val entityManagerFactory: EntityManagerFactory
) {
    fun toMcpValue(value: Any?): Any? = toMcpValue(value, Collections.newSetFromMap(IdentityHashMap()), 8)

    private fun toMcpValue(value: Any?, visited: MutableSet<Any>, depth: Int): Any? {
        if (value == null) {
            return null
        }
        if (value is String || value is Number || value is Boolean || value is Enum<*> || value is TemporalAccessor) {
            return value
        }
        if (value is JsonNode) {
            return when {
                value.isNull || value.isMissingNode -> null
                value.isBoolean -> value.asBoolean()
                value.isNumber -> value.numberValue()
                value.isTextual -> value.asText()
                value.isArray -> value.map { toMcpValue(it, visited, depth - 1) }
                value.isObject -> value.fields().asSequence().associate { it.key to toMcpValue(it.value, visited, depth - 1) }
                else -> value.asText()
            }
        }
        if (value is Iterable<*>) {
            return value.map { toMcpValue(it, visited, depth) }
        }
        if (value is Array<*>) {
            return value.map { toMcpValue(it, visited, depth) }
        }
        if (value is Map<*, *>) {
            return value.entries.associate { (key, entryValue) ->
                key.toString() to toMcpValue(entryValue, visited, depth - 1)
            }
        }
        val javaType = Hibernate.getClass(value)
        val type = registry.entities[javaType] ?: registry.embeddables[javaType] ?: return value.toString()

        if (depth <= 0 || !visited.add(value)) {
            return reference(value, type)
        }

        return try {
            type.fields.associate { field ->
                val fieldValue = if (type is EntityMetadata && field.name == type.idField.name) {
                    identifier(value) ?: readField(value, field.name)
                } else {
                    readField(value, field.name)
                }
                val mappedValue = when (field.kind) {
                    FieldKind.SCALAR, FieldKind.SCALAR_COLLECTION -> toMcpValue(fieldValue, visited, depth - 1)
                    FieldKind.EMBEDDED,
                    FieldKind.ENTITY_REFERENCE,
                    FieldKind.ENTITY_CHILD,
                    FieldKind.ENTITY_CHILD_COLLECTION -> toMcpValue(fieldValue, visited, depth - 1)
                }
                field.name to mappedValue
            }
        } finally {
            visited.remove(value)
        }
    }

    private fun reference(value: Any, type: ComplexTypeMetadata): Map<String, Any?> {
        val entity = registry.entities[Hibernate.getClass(value)]
        val id = entity?.let { identifier(value) ?: readField(value, it.idField.name) }
        return if (id == null) {
            mapOf("_type" to type.name)
        } else {
            mapOf("_type" to type.name, "id" to id)
        }
    }

    private fun identifier(value: Any): Any? =
        runCatching { entityManagerFactory.persistenceUnitUtil.getIdentifier(value) }.getOrNull()

    private fun readField(value: Any, name: String): Any? {
        var current: Class<*>? = Hibernate.getClass(value)
        while (current != null) {
            try {
                val field = current.getDeclaredField(name)
                field.isAccessible = true
                return field.get(value)
            } catch (_: NoSuchFieldException) {
                current = current.superclass
            }
        }
        return null
    }
}
