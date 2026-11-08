import { Schema, SchemaAST, Types } from "effect";
import { withStatics } from "./util/schema.js";
import { Identifier } from "./util/identifier.js";
import { NonNegativeInt } from "./util/schema.js";
import { ModelID, ProviderID } from "./llm/schema/schema.js";
import { schemaJson } from "effect/unstable/http/HttpClientResponse";
import { schemaCookies } from "effect/unstable/http/HttpServerRequest";
import { Tool } from "effect/unstable/ai";

// id portion

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

// part portion

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

export const ReasoningPart = Schema.Struct({
    ...partBase,
    type: Schema.Literal("Reasoning"),
    text: Schema.String,
    metadata: Schema.optional(
        Schema.Record(
            Schema.String,
            Schema.Any,
        ),
    ),
    time: Schema.Struct({
        start: NonNegativeInt,
        end: NonNegativeInt,
    }),
}).annotate({
    identifier: "ReasoningPart",
});

export type ReasoningPart = Schema.Schema.Type<typeof ReasoningPart>;

const filePartSourceBase = {
    text: Schema.Struct({
        value: Schema.String,
        start: Schema.Finite,
        end: Schema.Finite,
    }).annotate({
        identifier: "FilePartSourceText"
    })
};

export const Range = Schema.Struct({
    start: Schema.Struct({
        line: NonNegativeInt,
        character: NonNegativeInt,
    }),
    end: Schema.Struct({
        line: NonNegativeInt,
        character: NonNegativeInt,
    }),
}).annotate({
    identifier: "Range"
});

export type Range = Schema.Schema.Type<typeof Range>;

const FileSource = Schema.Struct({
    ...filePartSourceBase,
    type: Schema.Literal("file"),
    path: Schema.String,
}).annotate({
    identifier: "FileSource"
})

const SymbolSource = Schema.Struct({
    ...filePartSourceBase,
    type: Schema.Literal("symbol"),
    path: Schema.String,
    range: Range,
    name: Schema.String,
    kind: NonNegativeInt,
}).annotate({
    identifier: "SymbolSource"
})

const ResourceSource = Schema.Struct({
    ...filePartSourceBase,
    type: Schema.Literal("resource"),
    clientName: Schema.String,
    uri: Schema.String
}).annotate({
    identifier: "ResourceSource"
})

const FilePartSource = Schema.Union([
    FileSource,
    SymbolSource,
    ResourceSource
]).annotate({
    discriminator: "type",
    identifier: "FilePartSource"
})

export const FilePart = Schema.Struct({
    ...partBase,
    type: Schema.Literal("File"),
    mime: Schema.String,
    filename: Schema.optional(Schema.String),
    url: Schema.String,
    source: Schema.optional(FilePartSource)
}).annotate({
    identifier: "FilePart"
});

export const StepStartPart = Schema.Struct({
    ...partBase,
    type: Schema.Literal("Step-Start"),
    snapshot: Schema.optional(Schema.String),
}).annotate({
    identifier: "StepStartPart"
});

export type StepStartPart = Schema.Schema.Type<typeof StepStartPart>;

export const ToolStatePending = Schema.Struct({
    status: Schema.Literal("Pending"),
    input: Schema.Record(
        Schema.String,
        Schema.Any,
    ),
    raw: Schema.String,
}).annotate({
    identifier: "ToolStatePending"
});

export type ToolStatePending = Schema.Schema.Type<typeof ToolStatePending>;

export const ToolStateRunning = Schema.Struct({
    status: Schema.Literal("Running"),
    input: Schema.Record(
        Schema.String,
        Schema.Any,
    ),
    title: Schema.optional(Schema.String),
    metadata: Schema.optional(
        Schema.Record(
            Schema.String,
            Schema.Any,
        )
    ),
    time: Schema.Struct({
        start: NonNegativeInt,
    }),
}).annotate({
    identifier: "ToolStateRunning"
});

export type ToolStateRunning = Schema.Schema.Type<typeof ToolStateRunning>;

export const ToolStateCompleted = Schema.Struct({
    status: Schema.Literal("Completed"),
    input: Schema.Record(
        Schema.String,
        Schema.Any
    ),
    output: Schema.String,
    title: Schema.String,
    metadata: Schema.Record(
        Schema.String,
        Schema.Any,
    ),
    time: Schema.Struct({
        start: NonNegativeInt,
        end: NonNegativeInt,
        compacted: Schema.optional(NonNegativeInt),
    }),
    attachments: Schema.optional(Schema.Array(FilePart)),
}).annotate({
    identifier: "ToolStateCompleted"
});

export type ToolStateCompleted = Schema.Schema.Type<typeof ToolStateCompleted>;

export const ToolStateError = Schema.Struct({
    status: Schema.Literal("Error"),
    input: Schema.Record(
        Schema.String,
        Schema.Any
    ),
    error: Schema.String,
    metadata: Schema.optional(
        Schema.Record(
            Schema.String,
            Schema.Any,
        )
    ),
    time: Schema.Struct({
        start: NonNegativeInt,
        end: NonNegativeInt,
    })
}).annotate({
    identifier: "ToolStateError"
})

export type ToolStateError = Schema.Schema.Type<typeof ToolStateError>;

export const ToolState = Schema.Union([
    ToolStatePending,
    ToolStateRunning,
    ToolStateCompleted,
    ToolStateError,
]).annotate({
    discriminator: "status",
    identifier: "ToolState"
});

export type ToolState = Schema.Schema.Type<typeof ToolState>;

export const ToolPart = Schema.Struct({
    ...partBase,
    type: Schema.Literal("Tool"),
    callID: Schema.String,
    tool: Schema.String,
    state: ToolState,
    metadata: Schema.Record(
        Schema.String,
        Schema.Any,
    ),
}).annotate({
    identifier: "ToolPart"
})

export type ToolPart = Schema.Schema.Type<typeof ToolPart>