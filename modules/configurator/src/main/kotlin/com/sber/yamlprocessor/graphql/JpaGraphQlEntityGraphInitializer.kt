package com.sber.yamlprocessor.graphql

import org.hibernate.Hibernate
import org.springframework.stereotype.Component
import java.util.Collections
import java.util.IdentityHashMap

@Component
class JpaGraphQlEntityGraphInitializer(
    private val registry: JpaGraphQlRegistry
) {
    fun initialize(value: Any?, type: ComplexTypeMetadata) {
        val visited = Collections.newSetFromMap(IdentityHashMap<Any, Boolean>())
        initialize(value, type, visited)
    }

    private fun initialize(value: Any?, type: ComplexTypeMetadata, visited: MutableSet<Any>) {
        if (value == null || !visited.add(value)) {
            return
        }

        type.fields.forEach { field ->
            val current = getFieldValue(value, field.name) ?: return@forEach
            when (field.kind) {
                FieldKind.SCALAR, FieldKind.SCALAR_COLLECTION -> Hibernate.initialize(current)
                FieldKind.EMBEDDED -> initialize(current, registry.complexType(field.targetClass), visited)
                FieldKind.ENTITY_REFERENCE -> {
                    Hibernate.initialize(current)
                    initialize(current, registry.entity(field.targetClass), visited)
                }
                FieldKind.ENTITY_CHILD -> {
                    Hibernate.initialize(current)
                    initialize(current, registry.entity(field.targetClass), visited)
                }
                FieldKind.ENTITY_CHILD_COLLECTION -> {
                    Hibernate.initialize(current)
                    @Suppress("UNCHECKED_CAST")
                    (current as Iterable<Any>).forEach { child ->
                        initialize(child, registry.entity(field.targetClass), visited)
                    }
                }
            }
        }
    }
}
