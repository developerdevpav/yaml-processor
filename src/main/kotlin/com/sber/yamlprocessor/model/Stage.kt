package com.sber.yamlprocessor.model

import com.fasterxml.jackson.annotation.JsonIgnore
import com.fasterxml.jackson.annotation.JsonProperty
import jakarta.persistence.CascadeType
import jakarta.persistence.Column
import jakarta.persistence.Embedded
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.OneToOne
import jakarta.persistence.Table

@Entity
@Table(name = "stage")
class Stage(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @JsonIgnore
    @Column(name = "id")
    var dbId: Long? = null,

    @ManyToOne(optional = false)
    @JoinColumn(name = "subprocess_id")
    @JsonIgnore
    var subprocess: Subprocess? = null,

    @Column(name = "stage_bool_id")
    var id: Boolean? = null,

    @Column(name = "executor", nullable = false, length = 500)
    var executor: String = "",

    @Embedded
    var log: Log? = null,

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "context_code", referencedColumnName = "code")
    @JsonProperty("context-code")
    var contextCode: ContextCodesDictionary? = null,

    @Column(name = "description", nullable = false, length = 4000)
    var description: String = "",

    @OneToOne(cascade = [CascadeType.ALL], orphanRemoval = true)
    @JoinColumn(name = "configurator_id")
    var configurator: Configurator? = null
)
