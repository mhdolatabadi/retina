package dev.retina.telemetry;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class TokenUsageTest {

    @Test
    void countsInputAndOutputWithoutCountingSubsetsTwice() {
        TokenUsage usage = new TokenUsage("openrouter", "example/model", 100, 40, 70L, 10L, true);

        assertEquals(140, usage.totalTokens());
    }

    @Test
    void rejectsNegativeCounts() {
        assertThrows(IllegalArgumentException.class,
                () -> new TokenUsage("openrouter", "example/model", 10, -1, null, null, true));
    }

    @Test
    void preservesUnknownOptionalCounters() {
        TokenUsage usage = new TokenUsage("openrouter", "example/model", 10, 5, null, null, false);

        assertEquals(15, usage.totalTokens());
        assertEquals(null, usage.cachedTokens());
    }
}
