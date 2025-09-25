package com.sber.yamlprocessor.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotNull;

public class Audit {
    
    @NotNull(message = "Enabled is required")
    private Boolean enabled = false;
    
    @JsonProperty("event-code")
    @NotNull(message = "Event code is required")
    private String eventCode;
    
    @JsonProperty("event-description")
    @NotNull(message = "Event description is required")
    private String eventDescription;

    public Audit() {}

    public Audit(Boolean enabled, String eventCode, String eventDescription) {
        this.enabled = enabled;
        this.eventCode = eventCode;
        this.eventDescription = eventDescription;
    }

    // Getters and Setters
    public Boolean getEnabled() {
        return enabled;
    }

    public void setEnabled(Boolean enabled) {
        this.enabled = enabled;
    }

    public String getEventCode() {
        return eventCode;
    }

    public void setEventCode(String eventCode) {
        this.eventCode = eventCode;
    }

    public String getEventDescription() {
        return eventDescription;
    }

    public void setEventDescription(String eventDescription) {
        this.eventDescription = eventDescription;
    }
}
