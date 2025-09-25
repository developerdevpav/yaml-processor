package com.sber.yamlprocessor.model;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

public class SlaState {
    
    @Valid
    @NotNull(message = "Status is required")
    private SlaStatus status;
    
    private Integer durationValue;
    
    @Valid
    private SlaDurationUnit durationUnit;

    public SlaState() {}

    public SlaState(SlaStatus status) {
        this.status = status;
    }

    // Getters and Setters
    public SlaStatus getStatus() {
        return status;
    }

    public void setStatus(SlaStatus status) {
        this.status = status;
    }

    public Integer getDurationValue() {
        return durationValue;
    }

    public void setDurationValue(Integer durationValue) {
        this.durationValue = durationValue;
    }

    public SlaDurationUnit getDurationUnit() {
        return durationUnit;
    }

    public void setDurationUnit(SlaDurationUnit durationUnit) {
        this.durationUnit = durationUnit;
    }
}
