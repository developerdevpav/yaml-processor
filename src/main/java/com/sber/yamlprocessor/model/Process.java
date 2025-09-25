package com.sber.yamlprocessor.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public class Process {
    
    private String id;
    
    @JsonProperty("context-code")
    private ContextCodes contextCode;
    
    private Boolean disabled = false;
    
    @NotNull(message = "Description is required")
    private String description;
    
    @Valid
    @NotNull(message = "Subprocess is required")
    private List<Subprocess> subprocess;

    public Process() {}

    public Process(String description, List<Subprocess> subprocess) {
        this.description = description;
        this.subprocess = subprocess;
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

    public Boolean getDisabled() {
        return disabled;
    }

    public void setDisabled(Boolean disabled) {
        this.disabled = disabled;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public List<Subprocess> getSubprocess() {
        return subprocess;
    }

    public void setSubprocess(List<Subprocess> subprocess) {
        this.subprocess = subprocess;
    }
}
