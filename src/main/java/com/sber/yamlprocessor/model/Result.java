package com.sber.yamlprocessor.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public class Result {
    
    @JsonProperty("input-scenarios")
    @NotNull(message = "Input scenarios is required")
    private List<String> inputScenarios;
    
    @Valid
    @NotNull(message = "Reverse is required")
    private List<Reverse> reverse;

    public Result() {}

    public Result(List<String> inputScenarios, List<Reverse> reverse) {
        this.inputScenarios = inputScenarios;
        this.reverse = reverse;
    }

    // Getters and Setters
    public List<String> getInputScenarios() {
        return inputScenarios;
    }

    public void setInputScenarios(List<String> inputScenarios) {
        this.inputScenarios = inputScenarios;
    }

    public List<Reverse> getReverse() {
        return reverse;
    }

    public void setReverse(List<Reverse> reverse) {
        this.reverse = reverse;
    }
}
