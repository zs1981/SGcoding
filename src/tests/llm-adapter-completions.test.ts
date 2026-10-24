import assert from "node:assert/strict";
import test from "node:test";
import { Effect } from "effect";

import {
    apdaterState,
    toLLMEvents,
    type AISDKEvent,
} from "../model/aisdk.js";

test("finish preserves usage and resets adapter state", async () => {
    const state = apdaterState();

    state.step = 2;
    state.textIndex = 3;
    state.currentTextID = "text-active";
    state.reasoningIndex = 4;
    state.currentReasoningID = "reasoning-active";
    state.toolNames.set("call-1", "read");

    const event: AISDKEvent = {
        type: "finish",
        finishReason: "stop",
        rawFinishReason: undefined,
        totalUsage: {
            inputTokens: 100,
            inputTokenDetails: {
                noCacheTokens: 70,
                cacheReadTokens: 20,
                cacheWriteTokens: 10,
            },
            outputTokens: 40,
            outputTokenDetails: {
                textTokens: 30,
                reasoningTokens: 10,
            },
            totalTokens: 140,
        },
    };

    const events = await Effect.runPromise(
        toLLMEvents(state, event),
    );

    assert.equal(events.length, 1);

    const finish = events[0];

    assert.ok(finish);
    assert.equal(finish.type, "finish");

    if (finish.type !== "finish") {
        throw new Error("Expected a finish event");
    }

    assert.equal(finish.reason, "stop");
    assert.ok(finish.usage);

    assert.equal(finish.usage.inputTokens, 100);
    assert.equal(finish.usage.nonCachedInputTokens, 70);
    assert.equal(finish.usage.cacheReadInputTokens, 20);
    assert.equal(finish.usage.cacheWriteInputTokens, 10);
    assert.equal(finish.usage.outputTokens, 40);
    assert.equal(finish.usage.reasoningTokens, 10);
    assert.equal(finish.usage.totalTokens, 140);

    assert.deepEqual(state, apdaterState());
});

test("SDK error fails the adapter Effect", async () => {
    const original = new Error("Connection lost");

    const observed = await Effect.runPromise(
        toLLMEvents(apdaterState(), {
            type: "error",
            error: original,
        }).pipe(
            Effect.match({
                onFailure: (error) => error,
                onSuccess: () => undefined,
            }),
        ),
    );

    assert.equal(observed, original);
});