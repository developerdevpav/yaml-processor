package com.sber.yamlprocessor.model

import com.fasterxml.jackson.annotation.JsonIgnore
import jakarta.persistence.CascadeType
import jakarta.persistence.Column
import jakarta.persistence.Embedded
import jakarta.persistence.Entity
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.OneToOne
import jakarta.persistence.Table

@Entity
@Table(name = "stage")
class Stage(
    @ManyToOne(optional = false)
    @JoinColumn(name = "subprocess_id")
    @JsonIgnore
    var subprocess: Subprocess? = null,

    @Column(name = "executor", nullable = false, length = 500)
    var executor: String = "",

    @Embedded
    var log: Log? = null,

    @Column(name = "node_name", length = 255)
    var nodeName: String? = null,

    @Column(name = "node_comment", length = 4000)
    var nodeComment: String? = null,

    @OneToOne(cascade = [CascadeType.ALL], orphanRemoval = true)
    @JoinColumn(name = "configurator_id")
    var configurator: Configurator? = null
) : BaseEntity()
