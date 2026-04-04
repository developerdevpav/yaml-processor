package com.sber.yamlprocessor.model

import com.fasterxml.jackson.annotation.JsonIgnore
import jakarta.persistence.Column
import jakarta.persistence.Id
import jakarta.persistence.MappedSuperclass
import jakarta.persistence.PrePersist
import jakarta.persistence.PreUpdate
import java.time.Instant
import java.util.UUID

@MappedSuperclass
abstract class BaseEntity {
    @Id
    @JsonIgnore
    @Column(name = "id", nullable = false, updatable = false)
    var dbId: UUID? = null

    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: Instant? = null

    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant? = null

    @PrePersist
    fun prePersist() {
        val now = Instant.now()
        if (dbId == null) {
            dbId = UUID.randomUUID()
        }
        if (createdAt == null) {
            createdAt = now
        }
        updatedAt = now
    }

    @PreUpdate
    fun preUpdate() {
        updatedAt = Instant.now()
    }
}
