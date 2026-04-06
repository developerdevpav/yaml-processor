package com.sber.yamlprocessor.model

import com.fasterxml.jackson.annotation.JsonIgnore
import jakarta.persistence.CascadeType
import jakarta.persistence.Column
import jakarta.persistence.Embedded
import jakarta.persistence.Entity
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.OneToMany
import jakarta.persistence.OrderColumn
import jakarta.persistence.Table

@Entity
@Table(name = "subprocess")
class Subprocess(
    @ManyToOne(optional = false)
    @JoinColumn(name = "process_id")
    @JsonIgnore
    var process: Process? = null,

    @Column(name = "node_name", length = 255)
    var nodeName: String? = null,

    @Column(name = "node_comment", length = 4000)
    var nodeComment: String? = null,

    @Column(name = "disabled")
    var disabled: Boolean = false,

    @Embedded
    var trigger: Trigger = Trigger(),

    @OneToMany(mappedBy = "subprocess", cascade = [CascadeType.ALL], orphanRemoval = true)
    @OrderColumn(name = "stage_sort")
    var stages: MutableList<Stage> = mutableListOf()
) : BaseEntity()
