import { 
    Effect,
    Context,
    Cause,
    Layer,
    Stream,
    Exit
 } from "effect";

import type { LLMEvent } from "../model/schema/model-events.js";
import * as LLM from "../model/service.js";
import { MessageV2 } from "./message-v2.js";
import * as Session from "./service.js";
import * as SchemaV1 from "./schema/schema.js"
import { toError ,NamedError } from "../util/error.js";
import { text } from "node:stream/consumers";


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

                        assistantMessage.finish = event.reason;

                        if (event.reason === "error") {
                            return yield* Effect.fail(
                                new Error(
                                    "the model step finished with an error",
                                ),
                            );
                        }

                        yield* saveAssistant();
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

            if (!part) {
                return;
            }

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