import { Effect, Schema, Types } from "effect";
import {
    NonNegativeInt,
    withStatics,
} from "../util/schema.js";
import { Identifier } from "../util/identifier.js";
import { NamedError } from "../util/error.js";

export * as MessageV2 from "./message-v2.js";

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

export const ProviderID = Schema.String.pipe(
    Schema.brand("ProviderV2.ID"),
)
export const ModelID = Schema.String.pipe(
    Schema.brand("ProviderV2.ID"),
);

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

export const OutputLengthError = NamedError.create(
    "MessageOutputLengthError",
    {},
);

export const AuthError = NamedError.create(
    "ProviderAuthError",
    {
        providerID: Schema.String,
        message: Schema.String,
    },
);

export const AbortedError = NamedError.create(
    "MessageAbortedError",
    {
        message: Schema.String,
    },
);

export const StructuredOutputError = NamedError.create(
    "StructuredOutputError",
    {
        message: Schema.String,
        retries: NonNegativeInt,
    },
);

export const APIError = NamedError.create(
    "APIError",
    {
        message: Schema.String,
        statusCode: Schema.optional(NonNegativeInt),
        isRetryable: Schema.Boolean,
        responseHeaders: Schema.optional(
            Schema.Record(
                Schema.String,
                Schema.String,
            ),
        ),
    },
);

export type APIError = Schema.Schema.Type<typeof APIError.Schema>;

export const ContextOverflowError = NamedError.create(
    "ContextOverflowError",
    {
        message: Schema.String,
        responseBody: Schema.optional(Schema.String),
    },
);

export const ContentFilterError = NamedError.create(
    "ContentFilterError",
    {
        message: Schema.String,
    },
);

export class OutputFormatJsonSchema extends Schema.Class<
    OutputFormatJsonSchema
>("OutputFormatJsonSchema")({
    type: Schema.Literal("json_schema"),
    schema: Schema.Record(
        Schema.String,
        Schema.Any,
    ).annotate({
        identifier: "JSONSchema",
    }),
    retryCount: NonNegativeInt.pipe(
        Schema.optional,
        Schema.withDecodingDefault(
            Effect.succeed(2),
        ),
    ),
}) {}

export class OutputFormatText extends Schema.Class<
    OutputFormatText
>("OutputFormatText")({
    type: Schema.Literal("text"),
}) {}

export const Format = Schema.Union([
    OutputFormatJsonSchema,
    OutputFormatText
]).annotate({
    discriminator: "type",
    identifier: "OutputFormat",
});

export type OutputFormat = Schema.Schema.Type<typeof Format>;

const partBase = {
    id: PartID,
    sessionID: SessionID,
    messageID: MessageID,
}

export const SnapshotPart = Schema.Struct({
    ...partBase,
    type: Schema.Literal("snapshot"),
    snapshot: Schema.String,
}).annotate({
    identifier: "SnapshotPart",
});

export type SnapshotPart = Types.DeepMutable<
    Schema.Schema.Type<typeof SnapshotPart>
>;

export const PatchPart = Schema.Struct({
    ...partBase,
    type: Schema.Literal("patch"),
    hash: Schema.String,
    files: Schema.Array(Schema.String),
}).annotate({
    identifier: "PatchPart",
})

export type PatchPart = Types.DeepMutable<
    Schema.Schema.Type<typeof PatchPart>
>;

export const TextPart = Schema.Struct({
    ...partBase,
    type: Schema.Literal("text"),
    text: Schema.String,
    synthetic: Schema.optional(Schema.Boolean),
    ignored: Schema.optional(Schema.Boolean),
    time: Schema.optional(
        Schema.Struct({
            start: NonNegativeInt,
            end: Schema.optional(NonNegativeInt),
        }),
    ),
    metadata: Schema.optional(
        Schema.Record(
            Schema.String,
            Schema.Any,
        ),
    ),
}).annotate({
    identifier: "TextPart",
});

export type TextPart = Types.DeepMutable<
    Schema.Schema.Type<typeof TextPart>
>;

export const ReasoningPart = Schema.Struct({
    ...partBase,
    type: Schema.Literal("reasoning"),
    text: Schema.String,
    metadata: Schema.optional(
        Schema.Record(
            Schema.String,
            Schema.Any
        ),
    ),
    time: Schema.Struct({
        start: NonNegativeInt,
        end: Schema.optional(NonNegativeInt),
    })
}).annotate({
    identifier: "ReasoningPart",
});

export type ReasoningPart = Types.DeepMutable<
    Schema.Schema.Type<typeof ReasoningPart>
>;

const filePartSourceBase = {
    text: Schema.Struct({
        value: Schema.String,
        start: Schema.Finite,
        end: Schema.Finite,
    }).annotate({
        identifier: "FilePartSourceText",
    }),
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
    identifier: "Range",
})

export type Range = typeof Range.Type;

export const FileSource = Schema.Struct({
    ...filePartSourceBase,
    type: Schema.Literal("file"),   
    path: Schema.String, 
}).annotate({
    identifier: "FileSource",
});

export const SymbolSource = Schema.Struct({
    ...filePartSourceBase,
    type: Schema.Literal("symbol"),
    path: Schema.String,
    range: Range,
    name: Schema.String,
    kind: NonNegativeInt,
}).annotate({
    identifier: "SymbolSource"
});

export const ResourceSource = Schema.Struct({
    ...filePartSourceBase,
    type: Schema.Literal("resource"),
    clientName: Schema.String,
    uri: Schema.String,
}).annotate({
    identifier: "ResourceSource",
});

export const FilePartSource = Schema.Union([
    FileSource,
    SymbolSource,
    ResourceSource,
]).annotate({
    discriminator: "type",
    identifier: "FilePartSource",
})

export const FilePart = Schema.Struct({
    ...partBase,
    type: Schema.Literal("file"),
    mime: Schema.String,
    filename: Schema.optional(Schema.String),
    url: Schema.String,
    source: Schema.optional(FilePartSource),
}).annotate({
    identifier: "FilePart",
});

export type FilePart = Types.DeepMutable<
    Schema.Schema.Type<typeof FilePart>
>;

// Agent 引用。

export const AgentPart = Schema.Struct({
    ...partBase,
    type: Schema.Literal("agent"),
    name: Schema.String,
    source: Schema.optional(
        Schema.Struct({
            value: Schema.String,
            start: NonNegativeInt,
            end: NonNegativeInt,
        }),
    ),
}).annotate({
    identifier: "AgentPart",
});

export type AgentPart = Types.DeepMutable<
    Schema.Schema.Type<typeof AgentPart>
>;

// 上下文压缩。

export const CompactionPart = Schema.Struct({
    ...partBase,
    type: Schema.Literal("compaction"),
    auto: Schema.Boolean,
    overflow: Schema.optional(Schema.Boolean),
    tail_start_id: Schema.optional(MessageID),
}).annotate({
    identifier: "CompactionPart",
});

export type CompactionPart = Types.DeepMutable<
    Schema.Schema.Type<typeof CompactionPart>
>;

// 子任务。

export const SubtaskPart = Schema.Struct({
    ...partBase,
    type: Schema.Literal("subtask"),
    prompt: Schema.String,
    description: Schema.String,
    agent: Schema.String,
    model: Schema.optional(
        Schema.Struct({
            providerID: ProviderID,
            modelID: ModelID,
        }),
    ),
    command: Schema.optional(Schema.String),
}).annotate({
    identifier: "SubtaskPart",
});

export type SubtaskPart = Types.DeepMutable<
    Schema.Schema.Type<typeof SubtaskPart>
>;

// 重试。

export const RetryPart = Schema.Struct({
    ...partBase,
    type: Schema.Literal("retry"),
    attempt: NonNegativeInt,
    error: APIError.EffectSchema,
    time: Schema.Struct({
        created: NonNegativeInt,
    }),
}).annotate({
    identifier: "RetryPart",
});

export type RetryPart = Omit<
    Types.DeepMutable<
        Schema.Schema.Type<typeof RetryPart>
    >,
    "error"
> & {
    error: APIError;
};

// 模型步骤开始。

export const StepStartPart = Schema.Struct({
    ...partBase,
    type: Schema.Literal("step-start"),
    snapshot: Schema.optional(Schema.String),
}).annotate({
    identifier: "StepStartPart",
});

export type StepStartPart = Types.DeepMutable<
    Schema.Schema.Type<typeof StepStartPart>
>;

// 模型步骤结束。

export const StepFinishPart = Schema.Struct({
    ...partBase,
    type: Schema.Literal("step-finish"),
    reason: Schema.String,
    snapshot: Schema.optional(Schema.String),
    cost: Schema.Finite,
    tokens: Schema.Struct({
        total: Schema.optional(Schema.Finite),
        input: Schema.Finite,
        output: Schema.Finite,
        reasoning: Schema.Finite,
        cache: Schema.Struct({
            read: Schema.Finite,
            write: Schema.Finite,
        }),
    }),
}).annotate({
    identifier: "StepFinishPart",
});

export type StepFinishPart = Types.DeepMutable<
    Schema.Schema.Type<typeof StepFinishPart>
>;

// 工具状态：等待。

export const ToolStatePending = Schema.Struct({
    status: Schema.Literal("pending"),
    input: Schema.Record(
        Schema.String,
        Schema.Any,
    ),
    raw: Schema.String,
}).annotate({
    identifier: "ToolStatePending",
});

export type ToolStatePending = Types.DeepMutable<
    Schema.Schema.Type<typeof ToolStatePending>
>;

// 工具状态：执行中。

export const ToolStateRunning = Schema.Struct({
    status: Schema.Literal("running"),
    input: Schema.Record(
        Schema.String,
        Schema.Any,
    ),
    title: Schema.optional(Schema.String),
    metadata: Schema.optional(
        Schema.Record(
            Schema.String,
            Schema.Any,
        ),
    ),
    time: Schema.Struct({
        start: NonNegativeInt,
    }),
}).annotate({
    identifier: "ToolStateRunning",
});

export type ToolStateRunning = Types.DeepMutable<
    Schema.Schema.Type<typeof ToolStateRunning>
>;

// 工具状态：完成。

export const ToolStateCompleted = Schema.Struct({
    status: Schema.Literal("completed"),
    input: Schema.Record(
        Schema.String,
        Schema.Any,
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
    attachments: Schema.optional(
        Schema.Array(FilePart),
    ),
}).annotate({
    identifier: "ToolStateCompleted",
});

export type ToolStateCompleted = Types.DeepMutable<
    Schema.Schema.Type<typeof ToolStateCompleted>
>;

// 工具状态：失败。

export const ToolStateError = Schema.Struct({
    status: Schema.Literal("error"),
    input: Schema.Record(
        Schema.String,
        Schema.Any,
    ),
    error: Schema.String,
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
    identifier: "ToolStateError",
});

export type ToolStateError = Types.DeepMutable<
    Schema.Schema.Type<typeof ToolStateError>
>;

export const ToolState = Schema.Union([
    ToolStatePending,
    ToolStateRunning,
    ToolStateCompleted,
    ToolStateError,
]).annotate({
    discriminator: "status",
    identifier: "ToolState",
});

export type ToolState =
    | ToolStatePending
    | ToolStateRunning
    | ToolStateCompleted
    | ToolStateError;

// 工具调用内容块。

export const ToolPart = Schema.Struct({
    ...partBase,
    type: Schema.Literal("tool"),
    callID: Schema.String,
    tool: Schema.String,
    state: ToolState,
    metadata: Schema.optional(
        Schema.Record(
            Schema.String,
            Schema.Any,
        ),
    ),
}).annotate({
    identifier: "ToolPart",
});

export type ToolPart = Omit<
    Types.DeepMutable<
        Schema.Schema.Type<typeof ToolPart>
    >,
    "state"
> & {
    state: ToolState;
};

// 消息公共字段。

const messageBase = {
    id: MessageID,
    sessionID: SessionID,
};

const FileDiff = Schema.Struct({
    file: Schema.optional(Schema.String),
    patch: Schema.optional(Schema.String),
    additions: Schema.Finite,
    deletions: Schema.Finite,
    status: Schema.optional(
        Schema.Literals([
            "added",
            "deleted",
            "modified",
        ]),
    ),
}).annotate({
    identifier: "SnapshotFileDiff",
});


// Assistant 可记录的错误。

const AssistantErrorSchema = Schema.Union([
    AuthError.EffectSchema,
    NamedError.Unknown.EffectSchema,
    OutputLengthError.EffectSchema,
    AbortedError.EffectSchema,
    StructuredOutputError.EffectSchema,
    ContextOverflowError.EffectSchema,
    ContentFilterError.EffectSchema,
    APIError.EffectSchema,
]).annotate({
    discriminator: "name",
});

type AssistantError =
    Schema.Schema.Type<typeof AssistantErrorSchema>;

// 用户提交的内容块输入。
// 此时可以尚未分配 Part ID，也尚未补入消息和会话 ID。

export const TextPartInput = Schema.Struct({
    id: Schema.optional(PartID),
    type: Schema.Literal("text"),
    text: Schema.String,
    synthetic: Schema.optional(Schema.Boolean),
    ignored: Schema.optional(Schema.Boolean),
    time: Schema.optional(
        Schema.Struct({
            start: NonNegativeInt,
            end: Schema.optional(NonNegativeInt),
        }),
    ),
    metadata: Schema.optional(
        Schema.Record(
            Schema.String,
            Schema.Any,
        ),
    ),
}).annotate({
    identifier: "TextPartInput",
});

export type TextPartInput = Types.DeepMutable<
    Schema.Schema.Type<typeof TextPartInput>
>;

export const FilePartInput = Schema.Struct({
    id: Schema.optional(PartID),
    type: Schema.Literal("file"),
    mime: Schema.String,
    filename: Schema.optional(Schema.String),
    url: Schema.String,
    source: Schema.optional(FilePartSource),
}).annotate({
    identifier: "FilePartInput",
});

export type FilePartInput = Types.DeepMutable<
    Schema.Schema.Type<typeof FilePartInput>
>;

export const AgentPartInput = Schema.Struct({
    id: Schema.optional(PartID),
    type: Schema.Literal("agent"),
    name: Schema.String,
    source: Schema.optional(
        Schema.Struct({
            value: Schema.String,
            start: NonNegativeInt,
            end: NonNegativeInt,
        }),
    ),
}).annotate({
    identifier: "AgentPartInput",
});

export type AgentPartInput = Types.DeepMutable<
    Schema.Schema.Type<typeof AgentPartInput>
>;

export const SubtaskPartInput = Schema.Struct({
    id: Schema.optional(PartID),
    type: Schema.Literal("subtask"),
    prompt: Schema.String,
    description: Schema.String,
    agent: Schema.String,
    model: Schema.optional(
        Schema.Struct({
            providerID: ProviderID,
            modelID: ModelID,
        }),
    ),
    command: Schema.optional(Schema.String),
}).annotate({
    identifier: "SubtaskPartInput",
});

export type SubtaskPartInput = Types.DeepMutable<
    Schema.Schema.Type<typeof SubtaskPartInput>
>;

export const User = Schema.Struct({
    ...messageBase,
    role: Schema.Literal("user"),
    time: Schema.Struct({
        created: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)),
    }),
    format: Schema.optional(Format),
    summary: Schema.optional(
        Schema.Struct({
            title: Schema.optional(Schema.String),
            body: Schema.optional(Schema.String),
            diffs: Schema.Array(FileDiff),
        }),
    ),
    agent: Schema.String,
    model: Schema.Struct({
        providerID: ProviderID,
        modelID: ModelID,
        variant: Schema.optional(Schema.String),
    }),
    system: Schema.optional(Schema.String),
    tools: Schema.optional(
        Schema.Record(
            Schema.String,
            Schema.Boolean,
        ),
    ),
}).annotate({
    identifier: "UserMessage",
});

export type User = Types.DeepMutable<
    Schema.Schema.Type<typeof User>
>;

export const Assistant = Schema.Struct({
    ...messageBase,
    role: Schema.Literal("assistant"),
    time: Schema.Struct({
        created: NonNegativeInt,
        completed: Schema.optional(NonNegativeInt),
    }),
    error: Schema.optional(AssistantErrorSchema),
    parentID: MessageID,
    modelID: ModelID,
    providerID: ProviderID,
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
        output: Schema.Finite,
        reasoning: Schema.Finite,
        cache: Schema.Struct({
            read: Schema.Finite,
            write: Schema.Finite,
        }),
    }),
    structured: Schema.optional(Schema.Any),
    variant: Schema.optional(Schema.String),
    finish: Schema.optional(Schema.String),
}).annotate({
    identifier: "AssistantMessage",
});

export type Assistant = Omit<
    Types.DeepMutable<
        Schema.Schema.Type<typeof Assistant>
    >,
    "error"
> & {
    error?: AssistantError;
};

// 消息信息。
export const Part = Schema.Union([
    TextPart,
    SubtaskPart,
    ReasoningPart,
    FilePart,
    ToolPart,
    StepStartPart,
    StepFinishPart,
    SnapshotPart,
    PatchPart,
    AgentPart,
    RetryPart,
    CompactionPart,
]).annotate({
    discriminator: "type",
    identifier: "Part",
});

export type Part =
    | TextPart
    | SubtaskPart
    | ReasoningPart
    | FilePart
    | ToolPart
    | StepStartPart
    | StepFinishPart
    | SnapshotPart
    | PatchPart
    | AgentPart
    | RetryPart
    | CompactionPart;

export const Info = Schema.Union([
    User,
    Assistant,
]).annotate({
    discriminator: "role",
    identifier: "Message",
});

export type Info = User | Assistant;


export const WithParts = Schema.Struct({
    info: Info,
    parts: Schema.Array(Part),
});

export type WithParts = {
    info: Info;
    parts: Part[];
};
