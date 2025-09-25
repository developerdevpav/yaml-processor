package com.sber.yamlprocessor.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotNull;

public class Log {
    
    @JsonProperty("journal-service-name")
    @NotNull(message = "Journal service name is required")
    private String journalServiceName;

    public Log() {}

    public Log(String journalServiceName) {
        this.journalServiceName = journalServiceName;
    }

    // Getters and Setters
    public String getJournalServiceName() {
        return journalServiceName;
    }

    public void setJournalServiceName(String journalServiceName) {
        this.journalServiceName = journalServiceName;
    }
}
