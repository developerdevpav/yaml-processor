package com.sber.yamlprocessor.model

import com.fasterxml.jackson.annotation.JsonIgnore
import com.fasterxml.jackson.annotation.JsonProperty
import jakarta.persistence.CascadeType
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.OneToMany
import jakarta.persistence.OneToOne
import jakarta.persistence.OrderColumn
import jakarta.persistence.Table

@Entity
@Table(name = "process")
class Process(
    @OneToOne(optional = true)
    @JoinColumn(name = "process_config_id")
    @JsonIgnore
    var processConfig: ProcessConfig? = null,

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "context_code", referencedColumnName = "code")
    @field:JsonProperty("context-code")
    var contextCode: ContextCodesDictionary? = null,

    @Column(name = "disabled")
    var disabled: Boolean = false,

    @Column(name = "description", nullable = false, length = 4000)
    var description: String = "",

    @Column(name = "node_name", length = 255)
    var nodeName: String? = null,

    @Column(name = "node_comment", length = 4000)
    var nodeComment: String? = null,

    @OneToMany(mappedBy = "process", cascade = [CascadeType.ALL], orphanRemoval = true)
    @OrderColumn(name = "subprocess_sort")
    var subprocess: MutableList<Subprocess> = mutableListOf()
) : BaseEntity()
