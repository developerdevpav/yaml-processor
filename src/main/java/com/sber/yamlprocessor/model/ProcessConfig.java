package com.sber.yamlprocessor.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

public class ProcessConfig {
    
    @NotNull(message = "Process is required")
    @Valid
    private Process process;

    public ProcessConfig() {}

    public ProcessConfig(Process process) {
        this.process = process;
    }

    public Process getProcess() {
        return process;
    }

    public void setProcess(Process process) {
        this.process = process;
    }
}
