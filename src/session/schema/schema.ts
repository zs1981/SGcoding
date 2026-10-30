import { Schema, Types } from "effect";
import { withStatics } from "../../util/schema.js";
import { Identifier } from "../../util/identifier.js";
import { NonNegativeInt } from "../../util/schema.js";
import { ModelID, ProviderID } from "../../model/schema/schema.js";
import { schemaCookies } from "effect/unstable/http/HttpServerRequest";

export const SessionID = Schema.String.check(
    Schema.isStartsWith("ses"),
).pipe(
    Schema.brand("SessionID"),
    withStatics((schema) => ({
        ascending: (id?: string) =>
            schema.make(
                id ?? "ses_" + Identifier.ascending(),
            )
    })),
);

export type SessionID = typeof SessionID.Type;

export const MessageID = Schema.String.check(
    Schema.isStartsWith("msg"),
).pipe(
    Schema.brand("MessageID"),
    withStatics((schema) => ({
        ascending: (id?: string) =>
            schema.make(
                id ?? "msg_" + Identifier.ascending(),
            )
    })),
);

export type MessageID = typeof MessageID.Type;

export const PartID = Schema.String.check(
    Schema.isStartsWith("prt"),
).pipe(
    Schema.brand("PartID"),
    withStatics((schema) => ({
        ascending: (id?: string) => 
            schema.make(
                id ?? "prt_" + Identifier.ascending(),
            ),
    })),
);

export type PartID = typeof PartID.Type;

const messageID = {
    SessionID: SessionID,
    MessageID: MessageID,
}

const partBase = {
    SessionID: SessionID,
    MessageID: MessageID,
    PartID: PartID,
}

export const AssistantMessage = Schema.Struct({
    ...messageID,
    role: Schema.Literal("assistant"),
    time: Schema.Struct({
        created: NonNegativeInt,
        completed: Schema.Option(NonNegativeInt)
    }),
    error: Schema.optional(Schema.Any),
    ModelID: ModelID,
    ProviderID: ProviderID,
    mode: Schema.String,
    agent: Schema.String,
    path: Schema.Struct({
        cwd: Schema.String,
        root: Schema.String,
    }),
    summary: Schema.optional(Schema.Boolean),
    cost: Schema.Finite,
    tokens: Schema.Struct({
        total: Schema.optional(Schema.Finite),
        input: Schema.Finite,
        ouput: Schema.Finite,
        reasoning: Schema.Finite,
        cache: Schema.Struct({
            read: Schema.Finite,
            write: Schema.Finite,
        }),
        structured: Schema.optional(Schema.Any),  
        variant: Schema.optional(Schema.String),
        finish: Schema.optional(Schema.String),
    })
})

export const TextPart = Schema.Struct({
    ...partBase,
    type: Schema.Literal("Text"),
    text: Schema.String,
    time: Schema.optional(
        Schema.Struct({
            start: NonNegativeInt,
            end: Schema.optional(NonNegativeInt),
        })
    ),
    metadata: Schema.optional(
        Schema.Record(
            Schema.String,
            Schema.Any
        )
    ),
    synthetic: Schema.optional(Schema.Boolean),
    ingored: Schema.optional(Schema.Boolean),
}).annotate({
    identifier: "TextPart",
})

export type TextPart = Types.DeepMutable<Schema.Schema.Type<typeof TextPart>>;