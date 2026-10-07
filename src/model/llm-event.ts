import { Schema, SchemaAST } from "effect";
import { Tool } from "effect/unstable/ai";

export const ProviderMetaData = Schema.Record(
    Schema.String,
    Schema.Record(Schema.String, Schema.Unknown),
);

export const FinishReason = Schema.Literals([
    "stop",
    "length",
    "tool-calls",
    "content-filter",
    "error",
    "unknown",
]);

export class Usage extends Schema.Class<Usage>("LLM.Usage")({
    inputTokens: Schema.optional(Schema.Number),
    outputTokens: Schema.optional(Schema.Number),
    nonCachedInputTokens: Schema.optional(Schema.Number),
    cacheReadInputTokens: Schema.optional(Schema.Number),
    cacheWriteInputTokens: Schema.optional(Schema.Number),
    reasoningTokens: Schema.optional(Schema.Number),
    totalTokens: Schema.optional(Schema.Number),
}) {
    get visibleOutputTokens(): number {
        return Math.max(
            0,
            (this.outputTokens ?? 0) - (this.reasoningTokens ?? 0),
        );
    }
}

export const ToolContent = Schema.Union([
    Schema.Struct({
        type: Schema.tag("text"),
        text: Schema.String,
    }),

    Schema.Struct({
        type: Schema.tag("file"),
        uri: Schema.String,
        mime: Schema.String,
        name: Schema.optional(Schema.String),
    }),
]);

export type ToolContent =  Schema.Schema.Type<typeof ToolContent>;

export const ToolResultValue = Schema.Union([
    Schema.Struct({
        type: Schema.tag("json"),
        value: Schema.Unknown,
    }),

    Schema.Struct({
        type: Schema.tag("text"),
        value: Schema.Unknown,
    }),

    Schema.Struct({
        type: Schema.tag("error"),
        value: Schema.Unknown,
    }),

    Schema.Struct({
        type: Schema.tag("content"),
        value: Schema.Array(ToolContent),
    }),
]);

export type ToolResultValue = Schema.Schema.Type<typeof ToolResultValue>;


export const ToolOutput = Schema.Struct({
    structured: Schema.Unknown,
    content: Schema.Array(ToolContent),
});

export type ToolOutPut = typeof ToolOutput.Type;

const MetaData = {
    ProviderMetaData: Schema.optional(ProviderMetaData),
}

const block = {
    id: Schema.String,
    ...MetaData,
};

const tool = {
    id: Schema.String,
    name: Schema.String,
    ...MetaData,
};

export const LLMEvent = Schema.Union([
    Schema.Struct({
        type: Schema.tag("step-start"),
        index: Schema.Number,
    }),

    Schema.Struct({
        type: Schema.tag("text-start"),
        ...block,
    }),

    Schema.Struct({
        type: Schema.tag("text-delta"),
        ...block,
        text: Schema.String,
    }),

    Schema.Struct({
        type: Schema.tag("text-end"),
        ...block,
    }),

    Schema.Struct({
        type: Schema.tag("reasoing-start"),
        ...block,
    }),

    Schema.Struct({
        type: Schema.tag("reasoing-delta"),
        ...block,
        text: Schema.String,
    }),

    Schema.Struct({
        type: Schema.tag("reasoning-end"),
        ...block,
    }),

    Schema.Struct({
        type: Schema.tag("tool-input-start"),
        ...tool,
    }),

    Schema.Struct({
        type: Schema.tag("tool-input-delta"),
        id: Schema.String,
        name: Schema.String,
        text: Schema.String,
    }),

    Schema.Struct({
        type: Schema.tag("tool-input-end"),
        ...tool,
    }),

    Schema.Struct({
        type: Schema.tag("tool-result"),
        ...tool,
        result: ToolResultValue,
    }),

    Schema.Struct({
        type: Schema.tag("step-finish"),
        index: Schema.Number,
        reason: FinishReason,
        usage: Schema.optional(Usage),
        ...MetaData,
    }),

    Schema.Struct({
        type: Schema.tag("provider-error"),
        message: Schema.String,
        classification: Schema.optional(
            Schema.Literal("context-overflow"),
        ),
        retryable: Schema.optional(Schema.Boolean),
        ...MetaData,
    }),
]).pipe(Schema.toTaggedUnion("type"));

export type LLMEvent = Schema.Schema.Type<typeof LLMEvent>