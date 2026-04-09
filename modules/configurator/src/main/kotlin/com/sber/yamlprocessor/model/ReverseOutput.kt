package com.sber.yamlprocessor.model

import com.fasterxml.jackson.annotation.JsonIgnore
import jakarta.persistence.Column
import jakarta.persistence.Embedded
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.JoinColumn
import jakarta.persistence.Lob
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table

@Entity
@Table(name = "reverse_output")
class ReverseOutput(
    @ManyToOne(optional = false)
    @JoinColumn(name = "reverse_id")
    @JsonIgnore
    var reverse: Reverse? = null,

    @ManyToOne(optional = false, fetch = FetchType.EAGER)
    @JoinColumn(name = "phase", referencedColumnName = "code", nullable = false)
    var phase: ActionPhasesDictionary = ActionPhasesDictionary(code = "START"),

    @Column(name = "name", length = 2000)
    var name: String? = null,

    @Lob
    @Column(name = "rule")
    var rule: String? = null,

    @Embedded
    var body: Body = Body(),

    @Embedded
    var log: EventLog = EventLog()
) : BaseEntity()
