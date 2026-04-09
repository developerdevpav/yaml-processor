package com.sber.yamlprocessor.model

import com.fasterxml.jackson.annotation.JsonAlias
import com.fasterxml.jackson.annotation.JsonProperty
import jakarta.persistence.AssociationOverride
import jakarta.persistence.AssociationOverrides
import jakarta.persistence.AttributeOverride
import jakarta.persistence.AttributeOverrides
import jakarta.persistence.Column
import jakarta.persistence.Embeddable
import jakarta.persistence.Embedded
import jakarta.persistence.FetchType
import jakarta.persistence.JoinColumn
import jakarta.persistence.Lob
import jakarta.persistence.ManyToOne

@Embeddable
class Audit(
    @Column(name = "audit_enabled")
    var enabled: Boolean = false,

    @Column(name = "audit_event_code")
    @field:JsonAlias("eventCode")
    @field:JsonProperty("event-code")
    var eventCode: String? = null,

    @Column(name = "audit_event_description")
    @field:JsonAlias("eventDescription")
    @field:JsonProperty("event-description")
    var eventDescription: String? = null
)

@Embeddable
class Log(
    @Column(name = "stage_log_journal_service_name")
    @field:JsonAlias("journalServiceName")
    @field:JsonProperty("journal-service-name")
    var journalServiceName: String? = null
)

@Embeddable
class EventLog(
    @Column(name = "rev_out_journal_service_name")
    @field:JsonAlias("journalServiceName")
    @field:JsonProperty("journal-service-name")
    var journalServiceName: String = "",

    @Column(name = "rev_out_message")
    var message: String? = null
)

@Embeddable
class Trigger(
    @Lob
    @Column(name = "trigger_rule")
    var rule: String = ""
)

@Embeddable
class EventObject(
    @Column(name = "type")
    var type: String? = null
)

@Embeddable
class SlaState(
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "status", referencedColumnName = "code")
    var status: SlaStatusDictionary? = null,

    @Column(name = "duration_value")
    @field:JsonAlias("durationValue")
    @field:JsonProperty("duration_value")
    var durationValue: Int? = null,

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "duration_unit", referencedColumnName = "code")
    @field:JsonAlias("durationUnit")
    @field:JsonProperty("duration_unit")
    var durationUnit: SlaDurationUnitDictionary? = null
)

@Embeddable
class Service(
    @Column(name = "scenario")
    var scenario: String = "",

    @Column(name = "type")
    var type: String? = null,

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "status", referencedColumnName = "code")
    var status: B3StatusDictionary? = null,

    @Embedded
    var sla: SlaState? = null
)

@Embeddable
class Body(
    @Embedded
    @AttributeOverrides(
        AttributeOverride(name = "type", column = Column(name = "body_event_object_type"))
    )
    @field:JsonAlias("eventObject")
    @field:JsonProperty("event-object")
    var eventObject: EventObject? = null,

    @Embedded
    @AttributeOverrides(
        AttributeOverride(name = "scenario", column = Column(name = "body_service_scenario")),
        AttributeOverride(name = "type", column = Column(name = "body_service_type")),
        AttributeOverride(name = "sla.durationValue", column = Column(name = "body_service_sla_duration_value")),
    )
    @AssociationOverrides(
        AssociationOverride(
            name = "status",
            joinColumns = [JoinColumn(name = "body_service_status", referencedColumnName = "code")]
        ),
        AssociationOverride(
            name = "sla.status",
            joinColumns = [JoinColumn(name = "body_service_sla_status", referencedColumnName = "code")]
        ),
        AssociationOverride(
            name = "sla.durationUnit",
            joinColumns = [JoinColumn(name = "body_service_sla_duration_unit", referencedColumnName = "code")]
        )
    )
    var service: Service? = null,

    @Column(name = "body_type")
    var type: String? = null
)
