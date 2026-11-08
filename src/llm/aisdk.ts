import { Effect, Schema } from "effect";
import type {
    LanguageModelUsage,
    TextStreamPart,
    ToolSet
} from "ai";
import { toError } from "../util/error.js";
import {
    FinishReason,
    ProviderMetaData,
    ToolResultValue,
    Usage,
    type LLMEvent
} from "./schema/llm-event.js";

export type AISDKEvent = TextStreamPart<ToolSet>;

export interface AdapterState {
    step: number;

    textIndex: number;
    currentTextID: string | undefined;

    reasoningIndex: number;
    currentReasoningID: string | undefined;

    toolNames: Map<string, string>;
}

export function apdaterState(): AdapterState {
    return {
        step: 0,
        textIndex: 0,
        currentTextID: undefined,
        reasoningIndex: 0,
        currentReasoningID: undefined,
        toolNames: new Map(),
    };
}

function currentTextID(
    state: AdapterState,
    id: string | undefined,
): string {
    state.currentTextID = 
        id ??
        state.currentTextID ?? 
        `text-${state.textIndex++}`;

    return state.currentTextID;
}

function currentReasoningID(
    state: AdapterState,
    id: string | undefined,
): string {
    state.currentReasoningID =
        id ?? 
        state.currentReasoningID ??
        `reasoning-${state.reasoningIndex++}`;
    
    return state.currentReasoningID;
}

function metadata(value: unknown): typeof ProviderMetaData.Type | undefined {
    return Schema.is(ProviderMetaData)(value)
        ? value
        : undefined;
}

function reason(value: unknown): typeof FinishReason.Type {
    return Schema.is(FinishReason)(value)
        ? value
        : "unknown";
}

function usage(value: LanguageModelUsage): Usage {
    return new Usage({
        inputTokens: value.inputTokens,
        outputTokens: value.outputTokens,

        nonCachedInputTokens: value.inputTokenDetails.noCacheTokens,

        cacheReadInputTokens: value.inputTokenDetails.cacheReadTokens,

        cacheWriteInputTokens: value.inputTokenDetails.cacheWriteTokens,

        reasoningTokens: value.outputTokenDetails.reasoningTokens,

        totalTokens: value.totalTokens,
    });
}

function result(value: unknown): ToolResultValue {
    return Schema.is(ToolResultValue)(value)
        ? value
        : {type: "json", value};
}

export function toLLMEvents(
    state: AdapterState,
    event: AISDKEvent,
): Effect.Effect<readonly LLMEvent[], Error> {
    return Effect.try({
        try: (): readonly LLMEvent[] => {
            switch (event.type) { 
                case "start": {
                    return [];
                };

                case "start-step": {
                    return [{
                        type: "step-start",
                        index: state.step,
                    }];
                };

                case "finish-step": {
                    return [{
                        type: "step-finish",
                        index: state.step++,
                        reason: reason(event.finishReason),
                        usage: usage(event.usage),
                        providerMetadata: metadata(event.providerMetadata),
                    }];
                };

                case "text-start": {
                    const id = currentTextID(state, event.id);

                    return [{
                        type: "text-start",
                        id: id,
                        providerMetadata: metadata(event.providerMetadata),
                    }];
                };

                case "text-delta": {
                    const id = currentTextID(state, event.id);

                    return [{
                        type: "text-delta",
                        id: id,
                        text: event.text,
                        providerMetadata: metadata(event.providerMetadata)
                    }];
                };
                
                case "text-end": {
                    const id = currentTextID(state, event.id);

                    state.currentTextID = undefined;

                    return [{
                        type: "text-end",
                        id: id,
                        providerMetadata: metadata(event.providerMetadata),
                    }];
                };

                case "reasoning-start": {
                    const id = currentReasoningID(state, event.id);

                    return [{
                        type: "reasoning-start",
                        id: id,
                        providerMetadata: metadata(event.providerMetadata),
                    }];
                };

                case "reasoning-delta": {
                    const id = currentReasoningID(state, event.id);

                    return [{
                        type: "reasoning-delta",
                        id: id,
                        text: event.text,
                        providerMetadata: metadata(event.providerMetadata),
                    }];
                };     
                
                case "reasoning-end": {
                    const id = currentReasoningID(state, event.id);

                    state.currentReasoningID = undefined;

                    return [{
                        type: "reasoning-end",
                        id: id,
                        providerMetadata: metadata(event.providerMetadata),
                    }];
                };

                case "tool-input-start": {
                    state.toolNames.set(event.id, event.toolName);
                    
                    return [{
                        type: "tool-input-start",
                        id: event.id,
                        name: event.toolName,
                        providerMetadata: metadata(event.providerMetadata),
                    }];
                };

                case "tool-input-delta": {
                    const name = state.toolNames.get(event.id) ?? "unknown";  

                    return [{
                        type: "tool-input-delta",
                        id: event.id,
                        name: name,
                        text: event.delta ?? "",
                        providerMetadata: metadata(event.providerMetadata),
                    }];
                };

                case "tool-input-end": {
                    const name = state.toolNames.get(event.id) ?? "unknown"

                    return [{
                        type: "tool-input-end",
                        id: event.id,
                        name: name,
                        providerMetadata: metadata(event.providerMetadata),
                    }];
                };

                case "tool-call": {
                    state.toolNames.set(event.toolCallId, event.toolName);

                    return [{
                        type: "tool-call",
                        id: event.toolCallId,
                        name: event.toolName,
                        input: event.input,
                        providerExecuted: event.providerExecuted,
                        providerMetadata: metadata(event.providerMetadata),
                    }];
                };

                case "tool-result": {
                    if (event.preliminary === true) {
                        return [];
                    }

                    const name = state.toolNames.get(event.toolCallId) ?? "unknown";

                    const output = result(event.output);

                    state.toolNames.delete(event.toolCallId);

                    return [{
                        type: "tool-result",
                        id: event.toolCallId,
                        name: name,
                        result: output,
                        providerExecuted: event.providerExecuted,
                        providerMetadata: metadata(event.providerMetadata),
                    }];
                }; 

                case "tool-error": {
                    const name = state.toolNames.get(event.toolCallId) ?? event.toolName;

                    const message = toError(event.error).message;

                    state.toolNames.delete(event.toolCallId);

                    return [{
                        type: "tool-error",
                        id: event.toolCallId,
                        name: name,
                        message: message,
                        error: event.error,
                        providerMetadata: metadata(event.providerMetadata),
                    }];
                };

                case "error": {
                    throw event.error;
                };

                case "finish": {
                    Object.assign(state, apdaterState());

                    return [{
                        type: "finish",
                        reason: reason(event.finishReason),
                        usage: usage(event.totalUsage),
                    }];
                }

                case "abort": {
                    return [];
                };
                case "source": 
                case "file":
                case "reasoning-file":
                case "custom":
                case "raw":
                case "tool-approval-request":
                case "tool-approval-response":
                case "tool-output-denied":

                return [];    
            }

            const unhandled: never = event;

            throw new Error(
                "Unhandled AI SDK event: " + String(unhandled),
            )
        },

        catch: toError,
    })
}