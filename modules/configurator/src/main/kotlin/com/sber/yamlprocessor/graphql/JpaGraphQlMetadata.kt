package com.sber.yamlprocessor.graphql

import java.lang.reflect.Field

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
