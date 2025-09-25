package com.sber.yamlprocessor.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;

public class Body {
    
    @JsonProperty("event-object")
    @Valid
    private EventObject eventObject;
    
    @Valid
    private Service service;
    
    private String type;

    public Body() {}

    public Body(String type) {
        this.type = type;
    }

    // Getters and Setters
    public EventObject getEventObject() {
        return eventObject;
    }

    public void setEventObject(EventObject eventObject) {
        this.eventObject = eventObject;
    }

    public Service getService() {
        return service;
    }

    public void setService(Service service) {
        this.service = service;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }
}
