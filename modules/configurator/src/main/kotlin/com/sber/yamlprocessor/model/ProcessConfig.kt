package com.sber.yamlprocessor.model

import jakarta.persistence.CascadeType
import jakarta.persistence.Entity
import jakarta.persistence.OneToOne
import jakarta.persistence.Table

@Entity
@Table(name = "process_config")
class ProcessConfig(
    @OneToOne(mappedBy = "processConfig", cascade = [CascadeType.ALL], orphanRemoval = true)
    var process: Process? = null
) : BaseEntity()
