package com.sber.yamlprocessor.model;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

public class ReverseOutput {
    
    @Valid
    @NotNull(message = "Phase is required")
    private ActionPhases phase;
    
    private String name;
    
    private String rule;
    
    @Valid
    @NotNull(message = "Body is required")
    private Body body;
    
    @Valid
    @NotNull(message = "Log is required")
    private EventLog log;

    public ReverseOutput() {}

    public ReverseOutput(ActionPhases phase, Body body, EventLog log) {
        this.phase = phase;
        this.body = body;
        this.log = log;
    }

    // Getters and Setters
    public ActionPhases getPhase() {
        return phase;
    }

    public void setPhase(ActionPhases phase) {
        this.phase = phase;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getRule() {
        return rule;
    }

    public void setRule(String rule) {
        this.rule = rule;
    }

    public Body getBody() {
        return body;
    }

    public void setBody(Body body) {
        this.body = body;
    }

    public EventLog getLog() {
        return log;
    }

    public void setLog(EventLog log) {
        this.log = log;
    }
}
