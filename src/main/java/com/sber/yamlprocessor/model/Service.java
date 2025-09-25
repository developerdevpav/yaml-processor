package com.sber.yamlprocessor.model;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

public class Service {
    
    @NotNull(message = "Scenario is required")
    private String scenario;
    
    private String status;
    
    @Valid
    private SlaState sla;

    public Service() {}

    public Service(String scenario) {
        this.scenario = scenario;
    }

    // Getters and Setters
    public String getScenario() {
        return scenario;
    }

    public void setScenario(String scenario) {
        this.scenario = scenario;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public SlaState getSla() {
        return sla;
    }

    public void setSla(SlaState sla) {
        this.sla = sla;
    }
}
