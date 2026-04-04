package com.sber.yamlprocessor.model

import com.fasterxml.jackson.annotation.JsonIgnore
import jakarta.persistence.CascadeType
import jakarta.persistence.Column
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
@Table(name = "reverse_entry")
class Reverse(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @JsonIgnore
    @Column(name = "id")
    var dbId: Long? = null,

    @ManyToOne(optional = false)
    @JoinColumn(name = "result_id")
    @JsonIgnore
    var result: Result? = null,

    @ManyToOne(optional = false, fetch = FetchType.EAGER)
    @JoinColumn(name = "b3_status", referencedColumnName = "code", nullable = false)
    var status: B3StatusDictionary = B3StatusDictionary(code = "INITIATED"),

    @OneToMany(mappedBy = "reverse", cascade = [CascadeType.ALL], orphanRemoval = true)
    @OrderColumn(name = "output_sort")
    var output: MutableList<ReverseOutput> = mutableListOf()
)
