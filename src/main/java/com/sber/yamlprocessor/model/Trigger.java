package com.sber.yamlprocessor.model;

import jakarta.validation.constraints.NotNull;

public class Trigger {
    
    @NotNull(message = "Rule is required")
    private String rule;

    public Trigger() {}

    public Trigger(String rule) {
        this.rule = rule;
    }

    // Getters and Setters
    public String getRule() {
        return rule;
    }

    public void setRule(String rule) {
        this.rule = rule;
    }
}
