package dev.retina.telemetry;

/** Retains per-invocation usage as reported or estimated, without double-counting subsets. */
public record TokenUsage(
        String provider,
        String model,
        long inputTokens,
        long outputTokens,
        Long cachedTokens,
        Long reasoningTokens,
        boolean providerReported
) {

    public TokenUsage {
        if (provider == null || provider.isBlank() || model == null || model.isBlank()) {
            throw new IllegalArgumentException("provider and model are required");
        }
        if (inputTokens < 0 || outputTokens < 0
                || cachedTokens != null && cachedTokens < 0
                || reasoningTokens != null && reasoningTokens < 0) {
            throw new IllegalArgumentException("token counts must not be negative");
        }
    }

    public long totalTokens() {
        return Math.addExact(inputTokens, outputTokens);
    }
}
