package com.sber.yamlprocessor.model;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public class Reverse {
    
    @Valid
    @NotNull(message = "Status is required")
    private B3Status status;
    
    @Valid
    @NotNull(message = "Output is required")
    private List<ReverseOutput> output;

    public Reverse() {}

    public Reverse(B3Status status, List<ReverseOutput> output) {
        this.status = status;
        this.output = output;
    }

    // Getters and Setters
    public B3Status getStatus() {
        return status;
    }

    public void setStatus(B3Status status) {
        this.status = status;
    }

    public List<ReverseOutput> getOutput() {
        return output;
    }

    public void setOutput(List<ReverseOutput> output) {
        this.output = output;
    }
}
