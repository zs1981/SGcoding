import { Effect, Schema } from "effect";
import type {
    LanguageModelUsage,
    TextStreamPart,
    Tool,
    ToolSet
} from "ai";
import { toError } from "../util/error.js";
import {
    FinishReason,
    ProviderMetaData,
    ToolResultValue,
    Usage,
    type LLMEvent
} from "./llm-event.js";

export type AISDKEvent = TextStreamPart<ToolSet>;

export interface AdapterState {
    step: number;
    toolNames: Map<string, string>;
}

export function apdaterState(): AdapterState {
    return {
        step: 0,
        toolNames: new Map(),
    };
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
        cacheReadInputTokens: value.inputTokenDetails.noCacheTokens,
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
            switch (event.type) {  // 已经被定义了，为什么还需要再llm-events里面写出来，会不会重复定义
                case "start": {
                    return [];   // 为什么要使用括号
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
                        reason: reason(event.finishReason), // ai库的为什么能使用我再llm-event定义的finishreason
                        usage: usage(event.usage),
                        ProviderMetaData: metadata(event.providerMetadata), // 元数据是什么
                    }];
                };

                case "finish": {};

                case "text-start": {};

                case "text-end": {};

                case "reasoning-start": {};
                
                case "reasoning-end": {};
                
                case "text-delta": {};

                case "reasoning-delta": {};

                case "tool-input-start": {};

                case "tool-input-delta": {};

                case "tool-input-end": {};

                case "tool-call": {};

                case "tool-result": {}; // SDK 7 的临时结果不能提前结束工具调用。

                case "tool-error": {};

                case "error": {};

                case "abort": {};


                // 这些为什么不定义，是没必要还是怎么样，我愈发感觉llm-event存在很奇怪
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