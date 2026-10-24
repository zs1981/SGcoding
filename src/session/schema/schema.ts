import { Schema } from "effect";
import { withStatics } from "../../util/schema.js";
import { Identifier } from "../../util/identifier.js";
import { NonNegativeInt } from "../../util/schema.js";

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

const partBase = {
    SessionID: SessionID,
    MessageID: MessageID,
    PartID: PartID,
}

export const TextPart = Schema.Struct({
    ...partBase,
    type: Schema.Literal("Text"),
    text: Schema.String,
    time: Schema.optional(
        Schema.Struct({
            start: NonNegativeInt,
            end: NonNegativeInt,
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
})