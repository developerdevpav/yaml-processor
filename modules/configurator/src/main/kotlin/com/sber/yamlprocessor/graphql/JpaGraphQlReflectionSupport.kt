package com.sber.yamlprocessor.graphql

import java.lang.reflect.Field

internal fun getFieldValue(target: Any, fieldName: String): Any? {
    val field = findField(target.javaClass, fieldName)
    field.isAccessible = true
    return field.get(target)
}

internal fun setFieldValue(target: Any, fieldName: String, value: Any?) {
    val field = findField(target.javaClass, fieldName)
    field.isAccessible = true
    field.set(target, value)
}

internal fun instantiateReference(target: EntityMetadata, id: Any): Any {
    val instance = target.javaType.getDeclaredConstructor().newInstance()
    setFieldValue(instance, target.idField.name, id)
    return instance
}

internal fun instantiateDictionaryReference(referenceJavaType: Class<*>, code: Any): Any {
    val instance = referenceJavaType.getDeclaredConstructor().newInstance()
    setFieldValue(instance, "code", code.toString())
    return instance
}

internal fun findField(javaType: Class<*>, fieldName: String): Field {
    var current: Class<*>? = javaType
    while (current != null && current != Any::class.java) {
        runCatching { current.getDeclaredField(fieldName) }.getOrNull()?.let { return it }
        current = current.superclass
    }
    error("Field $fieldName not found in ${javaType.name}")
}
