package com.sber.yamlprocessor.model

import com.fasterxml.jackson.annotation.JsonCreator
import com.fasterxml.jackson.annotation.JsonValue
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.MappedSuperclass
import jakarta.persistence.Table
import org.hibernate.annotations.Immutable

@MappedSuperclass
@Immutable
abstract class DictionaryEntity(
    @Id
    @Column(name = "code", length = 64, nullable = false) var code: String = ""
) {
    @JsonValue
    fun toValue(): String = code
}

@Entity
@Table(name = "dict_b3_status")
class B3StatusDictionary(
    override var code: String = ""
) : DictionaryEntity(code) {
    companion object {
        @JvmStatic
        @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
        fun fromJson(value: String): B3StatusDictionary = B3StatusDictionary(code = value)
    }
}

@Entity
@Table(name = "dict_action_phases")
class ActionPhasesDictionary(
    override var code: String = ""
) : DictionaryEntity(code) {
    companion object {
        @JvmStatic
        @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
        fun fromJson(value: String): ActionPhasesDictionary = ActionPhasesDictionary(code = value)
    }
}

@Entity
@Table(name = "dict_sla_status")
class SlaStatusDictionary(
    override var code: String = ""
) : DictionaryEntity(code) {
    companion object {
        @JvmStatic
        @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
        fun fromJson(value: String): SlaStatusDictionary = SlaStatusDictionary(code = value)
    }
}

@Entity
@Table(name = "dict_context_codes")
class ContextCodesDictionary(
    override var code: String = ""
) : DictionaryEntity(code) {
    companion object {
        @JvmStatic
        @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
        fun fromJson(value: String): ContextCodesDictionary = ContextCodesDictionary(code = value)
    }
}

@Entity
@Table(name = "dict_sla_duration_unit")
class SlaDurationUnitDictionary(
    override var code: String = ""
) : DictionaryEntity(code) {
    companion object {
        @JvmStatic
        @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
        fun fromJson(value: String): SlaDurationUnitDictionary = SlaDurationUnitDictionary(code = value)
    }
}
