package com.sber.yamlprocessor.model;

import jakarta.validation.constraints.NotNull;

public class EventObject {
    
    @NotNull(message = "Type is required")
    private String type;

    public EventObject() {}

    public EventObject(String type) {
        this.type = type;
    }

    // Getters and Setters
    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }
}
