package dev.retina.agents;

/** Represents the lifecycle of an individual external agent execution. */
public enum AgentRunState {
    PENDING,
    RUNNING,
    SUCCEEDED,
    FAILED,
    CANCELLED
}
