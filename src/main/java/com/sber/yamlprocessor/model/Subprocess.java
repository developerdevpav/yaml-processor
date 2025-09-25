package com.sber.yamlprocessor.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public class Subprocess {
    
    private String id;
    
    @JsonProperty("context-code")
    private ContextCodes contextCode;
    
    private String description;
    
    private Boolean disabled = false;
    
    @Valid
    @NotNull(message = "Trigger is required")
    private Trigger trigger;
    
    @Valid
    @NotNull(message = "Stages is required")
    private List<Stage> stages;

    public Subprocess() {}

    public Subprocess(String description, Trigger trigger, List<Stage> stages) {
        this.description = description;
        this.trigger = trigger;
        this.stages = stages;
    }

    // Getters and Setters
    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public ContextCodes getContextCode() {
        return contextCode;
    }

    public void setContextCode(ContextCodes contextCode) {
        this.contextCode = contextCode;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Boolean getDisabled() {
        return disabled;
    }

    public void setDisabled(Boolean disabled) {
        this.disabled = disabled;
    }

    public Trigger getTrigger() {
        return trigger;
    }

    public void setTrigger(Trigger trigger) {
        this.trigger = trigger;
    }

    public List<Stage> getStages() {
        return stages;
    }

    public void setStages(List<Stage> stages) {
        this.stages = stages;
    }
}
