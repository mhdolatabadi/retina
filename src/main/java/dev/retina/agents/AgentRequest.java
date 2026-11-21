package dev.retina.agents;

import java.nio.file.Path;
import java.util.Objects;

/** Carries the explicit work assignment passed to an agent runtime. */
public record AgentRequest(
        String issueKey,
        AgentRole role,
        String model,
        Path workspace,
        String instructions
) {

    public AgentRequest {
        if (issueKey == null || issueKey.isBlank()) {
            throw new IllegalArgumentException("issueKey is required");
        }
        Objects.requireNonNull(role);
        if (model == null || model.isBlank()) {
            throw new IllegalArgumentException("model is required");
        }
        Objects.requireNonNull(workspace);
        if (instructions == null || instructions.isBlank()) {
            throw new IllegalArgumentException("instructions are required");
        }
    }
}
