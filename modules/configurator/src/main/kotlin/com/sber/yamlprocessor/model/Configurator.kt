package com.sber.yamlprocessor.model

import com.fasterxml.jackson.annotation.JsonIgnore
import com.fasterxml.jackson.annotation.JsonProperty
import jakarta.persistence.CascadeType
import jakarta.persistence.Column
import jakarta.persistence.Embedded
import jakarta.persistence.Entity
import jakarta.persistence.OneToMany
import jakarta.persistence.OneToOne
import jakarta.persistence.OrderColumn
import jakarta.persistence.Table

@Entity
@Table(name = "configurator")
class Configurator(
    @OneToOne(mappedBy = "configurator")
    @JsonIgnore
    var stage: Stage? = null,

    @Column(name = "disabled")
    var disabled: Boolean = false,

    @Column(name = "interrupted")
    var interrupted: Boolean = true,

    @Column(name = "multiple")
    var multiple: Boolean = false,

    @Embedded
    var audit: Audit? = null,

    @Column(name = "filter_event_rule", nullable = false, length = 4000)
    @field:JsonProperty("filter-event-rule")
    var filterEventRule: String = "",

    @OneToMany(mappedBy = "configurator", cascade = [CascadeType.ALL], orphanRemoval = true)
    @OrderColumn(name = "result_sort")
    var result: MutableList<Result> = mutableListOf()
) : BaseEntity()
