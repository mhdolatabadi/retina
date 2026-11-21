package dev.retina.agents;

import dev.retina.telemetry.TokenUsage;

/** Defines the agent execution boundary independently of OpenCode or a specific model. */
public interface AgentRuntime {

    String start(AgentRequest request);

    AgentRunState getStatus(String runId);

    TokenUsage getUsage(String runId);

    void cancel(String runId);
}
