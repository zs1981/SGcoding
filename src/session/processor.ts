import { 
    Effect,
    Context,
    Cause,
    Layer,
    Stream,
    Exit,
    Schema
 } from "effect";

import type { LLMEvent } from "../llm/schema/llm-event.js";
import * as LLM from "../llm/service.js";
import { MessageV2, ToolStateError } from "./message-v2.js";
import * as Session from "./service.js";
import * as SchemaV1 from "../schema.js"
import { toError ,NamedError } from "../util/error.js";
import { isRecord, outputText } from "../util/util.js";
import { undirected } from "effect/Graph";

type TextEvent = Extract<
    LLMEvent,
    {
        type: "text-start" | "text-delta" | "text-end";
    }
>;

type ReasoningEvent = Extract<
    LLMEvent,
    {
        type:
            | "reasoning-start"
            | "reasoning-delta"
            | "reasoning-end"
    }
>;

type ToolEvent = Extract<
    LLMEvent,
    {
        type:
            | "tool-input-start"
            | "tool-input-delta"
            | "tool-input-end"
            | "tool-call"
            | "tool-result"
            | "tool-error";
    }
>

type ToolResultEvent = Extract<
    ToolEvent,
    { type: "tool-result" }
>;

type ToolStateCompletedOutput = Pick<
    MessageV2.ToolStateCompleted,
    "output" | "title" | "metadata" | "attachments"
>;

type StepFinishEvent = Extract<
    LLMEvent,
    { type: "step-finish"}
>;

type StepUsage = Pick<
    MessageV2.StepFinishPart,
    "tokens" | "cost"
>;

type ProcessResult = 
    | "compact"
    | "stop"
    | "continue"

export function process(
    llm: LLM.Interface,
    sessions: Session.Interface,
    assistantMessage: MessageV2.Assistant,
    streamInput: LLM.StreamInput,
): Effect.Effect<ProcessResult> {
    return Effect.gen(function* () {
        const textHandler = makeTextHandler(
            sessions,
            assistantMessage,
        );

        const reasoningHandler = makeReasoningHandler(
            sessions,
            assistantMessage,
        );

        const toolHandler = makeToolHandler(
            sessions,
            assistantMessage,
        )

        const saveAssistant = (): Effect.Effect<void> => 
            Effect.gen(function* () {
                yield* sessions.UpdateMessage(structuredClone(assistantMessage));
            })

        const handleEvent = (event: LLMEvent): Effect.Effect<void, Error> =>
            Effect.gen(function* () {
                switch (event.type) {
                    case "text-start":
                    case "text-delta":
                    case "text-end":
                        yield* textHandler.handle(event);
                        return;

                    case "reasoning-start":
                    case "reasoning-delta":
                    case "reasoning-end":
                        yield* reasoningHandler.handle(event);
                        return;

                    case "step-start": 
                        return;
                    
                    case "step-finish":{
                        yield* reasoningHandler.finishAll();
                        yield* textHandler.finishAll();

                        const usage = StepUsage(event.usage);

                        const part: MessageV2.StepFinishPart = {
                            id: MessageV2.PartID.ascending(),
                            sessionID: assistantMessage.sessionID,
                            messageID: assistantMessage.id,
                            type: "step-finish",

                            reason: event.reason,
                            tokens: usage.tokens,
                            cost: usage.cost,
                        };

                        yield* sessions.UpdatePart(part);

                        assistantMessage.finish = event.reason;
                        assistantMessage.tokens = structuredClone(usage.tokens);
                        assistantMessage.cost += usage.cost;

                        yield* saveAssistant();

                        if (event.reason === "error") {
                            return yield* Effect.fail(
                                new Error(
                                    "the model step finished with an error",
                                ),
                            );
                        }

                        return;
                    }

                    case "finish": {
                        assistantMessage.finish ??= event.reason;

                        if (event.reason === "error") {
                            return yield* Effect.fail(
                                new Error(
                                    "The model stream finished with an error",
                                ),
                            );
                        }

                        return;
                    }

                    case "provider-error": {
                        assistantMessage.error = 
                            event.classification === "context-overflow"
                            ? new MessageV2.ContextOverflowError({
                                message: event.message,
                            }).toObject()
                            : new MessageV2.APIError({
                                message: event.message,
                                isRetryable: event.retryable ?? false
                            }).toObject();

                            return yield* Effect.fail(
                                new Error(event.message),
                            );
                    }

                    case "tool-input-start":
                    case "tool-input-delta":
                    case "tool-input-end":
                    case "tool-call":
                    case "tool-result":
                    case "tool-error": {
                        yield* toolHandler.handle(event);
                        return;
                    }
                    

                    default: {
                        const unhandled: never = event;

                        return yield* Effect.fail(
                            new Error(
                                `Unhandled LLM event: ${String(unhandled)}`
                            ),
                        );
                    }
                }
            });
        
        const finalize = (
            exit: Exit.Exit<void, Error>,
        ): Effect.Effect<void> => 
            Effect.gen(function* () {
                if (Exit.isFailure(exit)) {
                    if (assistantMessage.error === undefined) {
                        assistantMessage.error = 
                         Cause.hasInterruptsOnly(exit.cause)
                         ? new MessageV2.AbortedError({
                            message:"Response generation was interrupted"
                         }).toObject()
                         : new NamedError.Unknown({
                            message: toError(
                                Cause.squash(exit.cause)
                            ).message
                         }).toObject();
                    }

                    assistantMessage.finish = "error";
                }

                yield* textHandler.finishAll();
                yield* reasoningHandler.finishAll();
                yield* toolHandler.finishAll();

                assistantMessage.time.completed = Date.now();
                yield* saveAssistant();
                
                return;
            });

        yield* llm.stream(streamInput).pipe(
            Stream.runForEach(handleEvent),

            Effect.onExit(finalize),

            Effect.catch(() => Effect.void)
        );
        
        return assistantMessage.error
            ? "stop"
            : "continue";
    });
}

export function makeTextHandler(
    sessions: Session.Interface,
    assistantMessage: MessageV2.Assistant,
) {
    const active = new Map<
        string,
        MessageV2.TextPart
    >();

    const finishOne = (id: string): Effect.Effect<void> => 
        Effect.gen(function*() {
            const part = active.get(id);

            if (!part) return;

            const end = Date.now();

            part.time = {
                start: part.time?.start ?? end,
                end,
            };

            yield* sessions.UpdatePart(part);
            active.delete(id);
        });
    
    const finishAll = (): Effect.Effect<void> =>
        Effect.gen(function* () {
            for (const id of Array.from(active.keys())) {
                yield* finishOne(id);
            }
        })

    const handle = (
        event: TextEvent,
    ): Effect.Effect<void> => 
        Effect.gen(function* () {
            switch (event.type) {
                case "text-start": {
                    if (active.has(event.id)) {
                        return;
                    }

                    const part: MessageV2.TextPart = {
                        id: MessageV2.PartID.ascending(),
                        sessionID: assistantMessage.sessionID,
                        messageID: assistantMessage.id,
                        type: "text",
                        text: "",
                        time: {
                            start: Date.now()
                        },
                        metadata: event.providerMetadata,
                    };

                    active.set(event.id, part)

                    yield* sessions.UpdatePart(part);
                    return;
                };

                case "text-delta": {
                    const part = active.get(event.id)

                    if (!part) {
                        return;
                    }

                    part.text += event.text;

                    if (event.providerMetadata !== undefined) {
                        part.metadata = event.providerMetadata;
                    }

                    yield* sessions.DeltaPart(
                        part.sessionID,
                        part.messageID,
                        part.id,
                        "text",
                        event.text,
                    );

                    return;
                }

                case "text-end": {
                    const part = active.get(event.id);

                    if (!part) {
                        return;
                    }

                    if (event.providerMetadata !== undefined){
                        part.metadata = event.providerMetadata;
                    }

                    yield* finishOne(event.id);
                    return;
                }
            }
        });
    
    return {
        handle,
        finishAll,
    };
}

export function makeReasoningHandler(
    sessions: Session.Interface,
    assistantMessage: MessageV2.Assistant,
) {
    const active = new Map<
        string,
        MessageV2.ReasoningPart
    >();

    const finishOne = (id: string): Effect.Effect<void> => 
        Effect.gen(function* () {
            const part = active.get(id);

            if (!part) {
                return;
            }

            part.time.end = Date.now();

            yield* sessions.UpdatePart(part);

            active.delete(id);
        });

    const finishAll = (): Effect.Effect<void> =>
        Effect.gen(function * () {
            for (const id of Array.from(active.keys())) {
                yield* finishOne(id);
            }
        });

    const handle = (event: ReasoningEvent): Effect.Effect<void> => 
        Effect.gen(function* () {
            switch (event.type) {
                case "reasoning-start": {
                    if (active.has(event.id)) {
                        return;
                    }

                    const part: MessageV2.ReasoningPart = {
                        id: SchemaV1.PartID.ascending(),
                        sessionID: assistantMessage.sessionID,
                        messageID: assistantMessage.id,
                        type: "reasoning",
                        text: "",
                        time: {
                            start: Date.now(),
                        },
                        metadata: event.providerMetadata,
                    }

                    active.set(event.id, part);

                    yield* sessions.UpdatePart(part);
                    return;
                }

                case "reasoning-delta":{
                    const part = active.get(event.id);

                    if (!part) return;

                    part.text += event.text;

                    if (event.providerMetadata !== undefined) {
                        part.metadata = event.providerMetadata;
                    }

                    yield* sessions.DeltaPart(
                        part.sessionID,
                        part.messageID,
                        part.id,
                        "text",
                        event.text
                    );

                    return;
                }

                case "reasoning-end":{
                    const part = active.get(event.id);

                    if (part && event.providerMetadata !== undefined) {
                        part.metadata = event.providerMetadata;
                    }

                    yield* finishOne(event.id);
                }
            }
        });

    return {
        handle,
        finishAll,
    };
}

function toolResultOutput(
    event: ToolResultEvent,
    part: MessageV2.ToolPart,
): ToolStateCompletedOutput {
    const result = event.result;
    
    if (result.type === "content") {
        const texts: string[] = [];
        const attachments: MessageV2.FilePart[] = [];

        for (const item of result.value) {
            if (item.type === "text") {
                texts.push(item.text)
            } else {
                attachments.push({
                    id: MessageV2.PartID.ascending(),
                    sessionID: part.sessionID,
                    messageID: part.messageID,
                    type: "file",
                    mime: item.mime,
                    filename: item.name,
                    url: item.uri,
                });
            }
        }

        return {
            title: part.tool,
            output: texts.join("\n"),
            metadata: {},
            attachments: 
                attachments.length > 0
                    ? attachments
                    : undefined
        };
    }

    const value = result.value;

    if (isRecord(value) && typeof value.output === "string") {
        const attachments = Array.isArray(value.attachments)
            ? value.attachments.filter(
                (item): item is MessageV2.FilePart =>
                    Schema.is(MessageV2.FilePart)(item),
            )
            : undefined;

        return {
            output: value.output,
            title: 
                typeof value.title === "string"
                    ? value.title
                    : part.tool,
            metadata: 
                isRecord(value.metadata)
                    ? value.metadata
                    : {},
            attachments,
        }
    }

    return {
        output: outputText(value),
        title: part.tool,
        metadata:
            result.type === "json" && isRecord(value)
                ? value
                : {}
    }
}

export function makeToolHandler(
    sessions: Session.Interface,
    assistantMessage: MessageV2.Assistant,
) {
    const calls = new Map<
        string,
        MessageV2.ToolPart
    >();

    const isSettled = (part: MessageV2.ToolPart): boolean => 
        part.state.status === "completed" || part.state.status === "error";

    const updateMetadata = (
        part: MessageV2.ToolPart,
        event: ToolEvent
    ) : void => {
        const ProviderExecuted = 
            part.metadata?.providerExecuted === true ||
            (
                "providerExecuted" in event &&
            event.providerExecuted === true
            );

        if (event.providerMetadata === undefined && !ProviderExecuted) return;

        part.metadata = {
            ...part.metadata,
            ...event.providerMetadata,
            ...(ProviderExecuted
                ? { providerExecuted: true}
                : {}
            )
        }
    }

    const fail = (
        part: MessageV2.ToolPart,
        message: string,
        incomplete = false,
    ): Effect.Effect<void> => 
        Effect.gen(function* () {
            const previous = part.state;

            if (isSettled(part)) return;

            const end = Date.now();

            part.state = { //As far as I can tell, the exported format can't be edited, so the state can't be edited.
                status: "error",
                input: previous.input,
                error: message,
                metadata: {
                    ...(previous.status === "pending"
                        ? {rawInput: previous.raw}
                        : previous.metadata ?? {}),
                    ...(incomplete
                        ? { incomplete: true }
                        : {})
                },
                time: {
                    start: previous.status === "running"
                        ? previous.time.start
                        : end,
                    end,
                },
            };

            yield* sessions.UpdatePart(part);
        });
    
    const finishAll = (): Effect.Effect<void> => 
        Effect.gen(function* () {
            for (const part of calls.values()) {
                if (isSettled(part)) {
                    continue;
                }

                yield* fail(
                    part,
                    "Tool call ended before a result was received",
                    true,
                );

            }
            calls.clear();
        });

    const handle = (
        event: ToolEvent,
    ): Effect.Effect<void, Error> => 
        Effect.gen(function* () {
            switch (event.type) {
                case "tool-input-start": {
                    if (calls.has(event.id)) return;

                    const part: MessageV2.ToolPart = {
                        id: MessageV2.PartID.ascending(),
                        sessionID: assistantMessage.sessionID,
                        messageID: assistantMessage.id,
                        type: "tool",
                        callID: event.id,
                        tool: event.name,
                        state: {
                            status: "pending",
                            input: {},
                            raw: ""
                        },
                        metadata: event.providerMetadata,
                    }

                    calls.set(event.id, part);
                    yield* sessions.UpdatePart(part);
                    return;
                }

                case "tool-input-delta": {
                    const part = calls.get(event.id);

                    if (!part || part.state.status !== "pending") return;

                    if (event.name !== "unknown") {
                        part.tool = event.name;
                    }

                    updateMetadata(part, event);

                    part.state.raw += event.text;

                    yield* sessions.DeltaPart(
                        part.sessionID,
                        part.messageID,
                        part.id,
                        "text",
                        event.text,
                    )
                    return;
                }

                case "tool-input-end": {
                    const part = calls.get(event.id)

                    if (!part || part.state.status !== "pending") return;

                    updateMetadata(part, event);

                    yield* sessions.UpdatePart(part);
                    return;
                }

                case "tool-call": {
                    const part = calls.get(event.id);

                    if (!part || isSettled(part)) return;

                    if (event.name !== "unknown") {
                        part.tool = event.name;
                    }

                    updateMetadata(part, event);

                    const input = isRecord(event.input)
                        ? event.input
                        : { value: event.input }

                    part.state = 
                        part.state.status === "running"
                            ? {
                                ...part.state,
                                input
                            }
                            : {
                                status: "running",
                                input,
                                time: {
                                    start: Date.now(),
                                }
                            };
                    yield* sessions.UpdatePart(part);
                    return;    
                }

                case "tool-result": {
                    const part = calls.get(event.id);

                    if (!part) return;
                    
                    if (event.name !== "unknown") {
                        part.tool = event.name;
                    }

                    updateMetadata(part, event);

                    if (event.result.type === "error") {
                        const value = event.result.value;

                        const message = yield* Effect.try({
                            try: () => outputText(value),
                            catch: toError,
                        })

                        yield* fail(part, message);
                        return;
                    }

                    if (part.state.status !== "running") return;

                    const output = yield* Effect.try({
                        try: () => toolResultOutput(event, part),
                        catch: toError,
                    });

                    part.state = {
                        status: "completed",
                        input: part.state.input,
                        output: output.output,
                        title: output.title,
                        metadata: output.metadata,
                        attachments: output.attachments,
                        time: {
                            start: part.state.time.start,
                            end: Date.now(), 
                        },
                    };

                    yield* sessions.UpdatePart(part);
                    return;
                }

                case "tool-error": {
                    const part = calls.get(event.id);

                    if (!part || part.state.status !== "running") return;

                    if (event.name !== "unknown") {
                        part.tool = event.name;
                    }

                    updateMetadata(part, event);

                    yield* fail(part, event.message);
                    return;
                }
            }
        });

    return {
        handle,
        finishAll,
    }
}

function StepUsage(
    usage: StepFinishEvent["usage"],
): StepUsage {
    const safe = (value: number | undefined): number => {
        if (value === undefined || !Number.isFinite(value)) {
            return -1;
        }

        return value;
    };

    const input = safe(usage?.inputTokens);
    const output = safe(usage?.outputTokens);
    const reasoning = safe(usage?.reasoningTokens);

    const cacheRead = safe(usage?.cacheReadInputTokens);
    const cacheWrite = safe(usage?.cacheWriteInputTokens);

    const nonCachedInput = 
        usage?.nonCachedInputTokens !== undefined
            ? safe(usage.nonCachedInputTokens)
            : safe(input - cacheRead - cacheRead)

    return {
        cost: -1,
        
        tokens: {
            total:
                usage?.totalTokens === undefined
                    ? undefined
                    : safe(usage.totalTokens),

            input: nonCachedInput,
            output: safe(output - reasoning),
            reasoning,

            cache: {
                read: cacheRead,
                write: cacheRead,
            }
        }
    }
}