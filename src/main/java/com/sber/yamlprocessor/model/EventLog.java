package com.sber.yamlprocessor.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotNull;

public class EventLog {
    
    @JsonProperty("journal-service-name")
    @NotNull(message = "Journal service name is required")
    private String journalServiceName;
    
    private String message;

    public EventLog() {}

    public EventLog(String journalServiceName) {
        this.journalServiceName = journalServiceName;
    }

    // Getters and Setters
    public String getJournalServiceName() {
        return journalServiceName;
    }

    public void setJournalServiceName(String journalServiceName) {
        this.journalServiceName = journalServiceName;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }
}
