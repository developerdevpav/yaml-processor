package com.sber.yamlprocessor.model;

public enum B3Status {
    INITIATED,
    CANCELLED,
    ACCEPTED,
    STARTED,
    RUNNING,
    DATA_WAITING,
    EVENT_WAITING,
    PAUSED,
    POSITIVE_ENDING,
    NEUTRAL_ENDING,
    NEGATIVE_ENDING,
    SKIPPED,
    IS_ROLLING_BACK,
    HAS_ROLLED_BACK,
    FAULT,
    HOLD
}
