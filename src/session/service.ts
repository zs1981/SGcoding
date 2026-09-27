import { randomUUID } from "node:crypto";
import { Context, Effect, Layer } from "effect";
import * as Event from "../event/service.js";


export interface MessageInput {
    role: "user" | "assistant";
    content: string;
    status?: "success" | "error";
    error?: string | null;
}

export function isDefaultTitle(title: string): boolean {
    return /^(New session - |Child session - )\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(
        title,
    );
}

export interface Interface {
    readonly createSession: (title?: string) => Effect.Effect<string>;
    
    readonly appendMessage: (sessionID: string, input: MessageInput) => Effect.Effect<void>;

    readonly stepFail: (sessionID: string, messageID: string, error: string) => Effect.Effect<void>;

    readonly archiveSession: (sessionID: string) => Effect.Effect<void>;

    readonly unarchiveSession: (sessionID: string) => Effect.Effect<void>;

    readonly deleteSession: (sessionID: string) => Effect.Effect<void>;

    readonly setTitle: (sessionID: string, title: string) => Effect.Effect<void>;
}

export class Service extends Context.Service<
    Service,
    Interface
>()("sgcoing/Session") {}

export const layer = Layer.effect(
    Service,
    Effect.gen(function* () {
        const events = yield* Event.Service;

        return Service.of({
            createSession: (title?: string) =>
                Effect.gen(function* () {
                    const sessionID = `ses_${randomUUID()}`;
                    const timeCreate = Date.now();

                    yield* events.publish({
                        aggregateId: sessionID,
                        type: "session.created",
                        data: {
                            title:
                                title?.trim() ||
                                `New session - ${new Date(timeCreate).toISOString()}`,
                            timeCreate: timeCreate,
                        },
                    });

                    return sessionID;
                }),
                
            appendMessage: (sessionID: string, input: MessageInput) =>
                Effect.gen(function* () {
                    const messageID = `msg_${randomUUID()}`;

                    yield* events.publish({
                        aggregateId: sessionID,
                        type: "message.append",
                        data: {
                            messageId: messageID,
                            role: input.role,
                            content: input.content,
                            status: input.status ?? "success",
                            error: input.error ?? null,
                            timeCreate: Date.now(),
                        }
                    });
                }),
            
            stepFail: (sessionID: string, messageID: string, error: string) => 
                Effect.gen(function* () {
                    yield* events.publish({
                        aggregateId: sessionID,
                        type: "step.failed",
                        data: {
                            messageId: messageID,
                            error: error,
                        }
                    })
                }),

            archiveSession: (sessionID: string) =>
                Effect.gen(function* () {
                    yield* events.publish({
                        aggregateId: sessionID,
                        type: "session.archived",
                        data: {
                            timeArchived: Date.now(),
                        }
                    })
                }),

            unarchiveSession: (sessionID:string) =>
                Effect.gen(function* () {
                    yield* events.publish({
                        aggregateId: sessionID,
                        type: "session.unarchived",
                        data: {},
                    })
                }),

            setTitle: (sessionID: string, title: string) => 
                Effect.gen(function* () {
                    yield* events.publish({
                        aggregateId: sessionID,
                        type: "title.set",
                        data: {
                            title: title,
                        }
                    })
                }),

            deleteSession: (sessionID: string) =>
                Effect.gen(function* () {
                    yield* events.publish({
                        aggregateId: sessionID,
                        type: "session.deleted",
                        data: {},
                    })
                }),
        });
    })
);

export const defaultLayer = layer.pipe(
    Layer.provide(Event.defaultLayer),
);

export const testLayer = layer.pipe(
    Layer.provideMerge(Event.testLayer)
)