package com.sber.yamlprocessor.model

import com.fasterxml.jackson.annotation.JsonIgnore
import com.fasterxml.jackson.annotation.JsonProperty
import jakarta.persistence.CascadeType
import jakarta.persistence.CollectionTable
import jakarta.persistence.Column
import jakarta.persistence.ElementCollection
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.OneToMany
import jakarta.persistence.OrderColumn
import jakarta.persistence.Table

@Entity
@Table(name = "result")
class Result(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @JsonIgnore
    @Column(name = "id")
    var dbId: Long? = null,

    @ManyToOne(optional = false)
    @JoinColumn(name = "configurator_id")
    @JsonIgnore
    var configurator: Configurator? = null,

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "result_input_scenario", joinColumns = [JoinColumn(name = "result_id")])
    @Column(name = "scenario", length = 2000)
    @OrderColumn(name = "scenario_sort")
    @JsonProperty("input-scenarios")
    var inputScenarios: MutableList<String> = mutableListOf(),

    @OneToMany(mappedBy = "result", cascade = [CascadeType.ALL], orphanRemoval = true)
    @OrderColumn(name = "reverse_sort")
    var reverse: MutableList<Reverse> = mutableListOf()
)
