package com.sber.yamlprocessor.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public class Configurator {
    
    private Boolean disabled = false;
    
    private Boolean interrupted = true;
    
    private Boolean multiple = false;
    
    @Valid
    private Audit audit;
    
    @JsonProperty("filter-event-rule")
    @NotNull(message = "Filter event rule is required")
    private String filterEventRule;
    
    @Valid
    private List<Result> result;

    public Configurator() {}

    public Configurator(String filterEventRule) {
        this.filterEventRule = filterEventRule;
    }

    // Getters and Setters
    public Boolean getDisabled() {
        return disabled;
    }

    public void setDisabled(Boolean disabled) {
        this.disabled = disabled;
    }

    public Boolean getInterrupted() {
        return interrupted;
    }

    public void setInterrupted(Boolean interrupted) {
        this.interrupted = interrupted;
    }

    public Boolean getMultiple() {
        return multiple;
    }

    public void setMultiple(Boolean multiple) {
        this.multiple = multiple;
    }

    public Audit getAudit() {
        return audit;
    }

    public void setAudit(Audit audit) {
        this.audit = audit;
    }

    public String getFilterEventRule() {
        return filterEventRule;
    }

    public void setFilterEventRule(String filterEventRule) {
        this.filterEventRule = filterEventRule;
    }

    public List<Result> getResult() {
        return result;
    }

    public void setResult(List<Result> result) {
        this.result = result;
    }
}
