import { Context, Effect, Layer } from "effect";
import * as Event from "../event/service.js";
import { MessageID, MessageV2 } from "./message-v2.js";


export function isDefaultTitle(title: string): boolean {
    return /^(New session - |Child session - )\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(
        title,
    );
}

export interface Interface {
    readonly createSession: (title?: string) => Effect.Effect<MessageV2.SessionID>;
    
    readonly archiveSession: (sessionID: MessageV2.SessionID) => Effect.Effect<void>;

    readonly unarchiveSession: (sessionID: MessageV2.SessionID) => Effect.Effect<void>;

    readonly deleteSession: (sessionID: MessageV2.SessionID) => Effect.Effect<void>;

    readonly setTitle: (sessionID: MessageV2.SessionID, title: string) => Effect.Effect<void>;

    readonly updateMessage: <T extends MessageV2.Info>(info: T) => Effect.Effect<T>;

    readonly updatePart: <T extends MessageV2.Part>(part: T) => Effect.Effect<T>;
    
    readonly removeMessage: (sessionID: MessageV2.SessionID, messageID: MessageV2.MessageID) => Effect.Effect<MessageV2.MessageID>;

    readonly removePart: (sessionID: MessageV2.SessionID, messageID: MessageV2.MessageID, partID: MessageV2.PartID) => Effect.Effect<MessageV2.PartID>;

    readonly updatePartDelta: (sessionID: MessageV2.SessionID, messageID: MessageV2.MessageID, partID: MessageV2.PartID, field: string, delta: string) => Effect.Effect<void>;
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
                    const sessionID = MessageV2.SessionID.ascending();
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
            
            archiveSession: (sessionID: MessageV2.SessionID) =>
                Effect.gen(function* () {
                    yield* events.publish({
                        aggregateId: sessionID,
                        type: "session.archived",
                        data: {
                            timeArchived: Date.now(),
                        }
                    })
                }),

            unarchiveSession: (sessionID: MessageV2.SessionID) =>
                Effect.gen(function* () {
                    yield* events.publish({
                        aggregateId: sessionID,
                        type: "session.unarchived",
                        data: {},
                    })
                }),

            setTitle: (sessionID: MessageV2.SessionID, title: string) => 
                Effect.gen(function* () {
                    yield* events.publish({
                        aggregateId: sessionID,
                        type: "title.set",
                        data: {
                            title: title,
                        }
                    })
                }),

            deleteSession: (sessionID: MessageV2.SessionID) =>
                Effect.gen(function* () {
                    yield* events.publish({
                        aggregateId: sessionID,
                        type: "session.deleted",
                        data: {},
                    })
                }),

            updateMessage: <T extends MessageV2.Info>(info: T) =>
                Effect.gen(function* () {
                    yield* events.publish({
                        aggregateId: info.sessionID,
                        type: "message.updated",
                        data: {
                            info
                        },
                    });

                    return info;
                }).pipe(
                    Effect.withSpan("Sesion.updataMessage")
                ),
            
            updatePart: <T extends MessageV2.Part>(part: T) =>
                Effect.gen(function* () {
                  yield* events.publish({
                    aggregateId: part.sessionID,
                    type: "message.part.updated",
                    data: {
                        part: structuredClone(part),
                        time: Date.now(),
                    },

                  });  

                  return part;
                }).pipe(
                    Effect.withSpan("Session.updataPart"),
                ),

            removeMessage: (sessionID: MessageV2.SessionID, messageID: MessageV2.MessageID) => 
                Effect.gen(function* () {
                    yield* events.publish({
                        aggregateId: sessionID,
                        type: "message.removed",
                        data: {
                            sessionID: sessionID,
                            messageID: messageID,
                        },
                    })

                    return messageID;
                }),
            
            removePart: (sessionID: MessageV2.SessionID, messageID: MessageV2.MessageID, partID: MessageV2.PartID) =>
                Effect.gen(function* () {
                    yield* events.publish({
                        aggregateId: sessionID,
                        type: "message.part.removed",
                        data: {
                            sessionID: sessionID,
                            messageID: messageID,
                            partID: partID,
                        }
                    })

                    return partID;
                }),

            updatePartDelta: (sessionID: MessageV2.SessionID, messageID: MessageV2.MessageID, partID: MessageV2.PartID, field: string, delta: string) => 
                Effect.gen(function* () {
                    yield* events.publish({
                        aggregateId: sessionID,
                        type: "message.part.delta",
                        data: {
                            sessionID: sessionID,
                            messageID: messageID,
                            partID: partID,
                            field: field,
                            delta: delta,
                        }
                    })
                })
        });
    })
);

export const defaultLayer = layer.pipe(
    Layer.provide(Event.defaultLayer),
);

export const testLayer = layer.pipe(
    Layer.provideMerge(Event.testLayer)
)