package com.sber.yamlprocessor.graphql

import org.springframework.stereotype.Component
import java.util.UUID

@Component
class GraphQlIdConverter {
    fun convert(raw: Any?, targetType: Class<*>): Any {
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
}
