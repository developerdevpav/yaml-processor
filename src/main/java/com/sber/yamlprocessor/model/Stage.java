package com.sber.yamlprocessor.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

public class Stage {
    
    private Boolean id;
    
    @NotNull(message = "Executor is required")
    private String executor;
    
    @Valid
    private Log log;
    
    @JsonProperty("context-code")
    private ContextCodes contextCode;
    
    @NotNull(message = "Description is required")
    private String description;
    
    @Valid
    @NotNull(message = "Configurator is required")
    private Configurator configurator;

    public Stage() {}

    public Stage(String executor, String description, Configurator configurator) {
        this.executor = executor;
        this.description = description;
        this.configurator = configurator;
    }

    // Getters and Setters
    public Boolean getId() {
        return id;
    }

    public void setId(Boolean id) {
        this.id = id;
    }

    public String getExecutor() {
        return executor;
    }

    public void setExecutor(String executor) {
        this.executor = executor;
    }

    public Log getLog() {
        return log;
    }

    public void setLog(Log log) {
        this.log = log;
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

    public Configurator getConfigurator() {
        return configurator;
    }

    public void setConfigurator(Configurator configurator) {
        this.configurator = configurator;
    }
}
