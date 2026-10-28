import { Context, Effect, Layer } from "effect";
import * as Event from "../event/interface.js";
import { MessageID, MessageV2 } from "./message-v2.js";


export function isDefaultTitle(title: string): boolean {
    return /^(New session - |Child session - )\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(
        title,
    );
}

export interface Interface {
    readonly CreateSession: (title?: string) => Effect.Effect<MessageV2.SessionID>;
    
    readonly ArchiveSession: (sessionID: MessageV2.SessionID) => Effect.Effect<void>;

    readonly UnarchiveSession: (sessionID: MessageV2.SessionID) => Effect.Effect<void>;

    readonly DeleteSession: (sessionID: MessageV2.SessionID) => Effect.Effect<void>;

    readonly SetTitle: (sessionID: MessageV2.SessionID, title: string) => Effect.Effect<void>;

    readonly UpdateMessage: <T extends MessageV2.Info>(info: T) => Effect.Effect<T>;

    readonly UpdatePart: <T extends MessageV2.Part>(part: T) => Effect.Effect<T>;
    
    readonly RemoveMessage: (sessionID: MessageV2.SessionID, messageID: MessageV2.MessageID) => Effect.Effect<MessageV2.MessageID>;

    readonly RemovePart: (sessionID: MessageV2.SessionID, messageID: MessageV2.MessageID, partID: MessageV2.PartID) => Effect.Effect<MessageV2.PartID>;

    readonly DeltaPart: (sessionID: MessageV2.SessionID, messageID: MessageV2.MessageID, partID: MessageV2.PartID, field: string, delta: string) => Effect.Effect<void>;
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
            CreateSession: (title?: string) =>
                Effect.gen(function* () {
                    const sessionID = MessageV2.SessionID.ascending();
                    const timeCreate = Date.now();

                    yield* events.publish({
                        aggregateID: sessionID,
                        type: "session.create",
                        data: {
                            SessionID: sessionID,
                            title:
                                title?.trim() ||
                                `New session - ${new Date(timeCreate).toISOString()}`,
                            timeCreate: timeCreate,
                        },
                    });

                    return sessionID;
                }),
            
            ArchiveSession: (sessionID: MessageV2.SessionID) =>
                Effect.gen(function* () {
                    yield* events.publish({
                        aggregateID: sessionID,
                        type: "session.archive",
                        data: {
                            SessionID: sessionID,
                            timeArchived: Date.now(),
                        }
                    })
                }),

            UnarchiveSession: (sessionID: MessageV2.SessionID) =>
                Effect.gen(function* () {
                    yield* events.publish({
                        aggregateID: sessionID,
                        type: "session.unarchive",
                        data: {
                            SessionID: sessionID,
                        },
                    })
                }),

            SetTitle: (sessionID: MessageV2.SessionID, title: string) => 
                Effect.gen(function* () {
                    yield* events.publish({
                        aggregateID: sessionID,
                        type: "title.set",
                        data: {
                            SessionID: sessionID,
                            Title: title,
                        }
                    })
                }),

            DeleteSession: (sessionID: MessageV2.SessionID) =>
                Effect.gen(function* () {
                    yield* events.publish({
                        aggregateID: sessionID,
                        type: "session.delete",
                        data: {
                            SessionID: sessionID,
                        },
                    })
                }),

            UpdateMessage: <T extends MessageV2.Info>(info: T) =>
                Effect.gen(function* () {
                    yield* events.publish({
                        aggregateID: info.sessionID,
                        type: "message.update",
                        data: {
                            SessionID: info.sessionID,
                            Info: info
                        },
                    });

                    return info;
                }).pipe(
                    Effect.withSpan("Sesion.updataMessage")
                ),
            
            UpdatePart: <T extends MessageV2.Part>(part: T) =>
                Effect.gen(function* () {
                  yield* events.publish({
                    aggregateID: part.sessionID,
                    type: "message.part.update",
                    data: {
                        SessionID: part.sessionID,
                        MessageID: part.messageID,
                        Part: structuredClone(part),
                        Time: Date.now(),
                    },

                  });  

                  return part;
                }).pipe(
                    Effect.withSpan("Session.updataPart"),
                ),

            RemoveMessage: (sessionID: MessageV2.SessionID, messageID: MessageV2.MessageID) => 
                Effect.gen(function* () {
                    yield* events.publish({
                        aggregateID: sessionID,
                        type: "message.remove",
                        data: {
                            SessionID: sessionID,
                            MessageID: messageID,
                        },
                    })

                    return messageID;
                }),
            
            RemovePart: (sessionID: MessageV2.SessionID, messageID: MessageV2.MessageID, partID: MessageV2.PartID) =>
                Effect.gen(function* () {
                    yield* events.publish({
                        aggregateID: sessionID,
                        type: "message.part.remove",
                        data: {
                            SessionID: sessionID,
                            MessageID: messageID,
                            PartID: partID,
                        }
                    })

                    return partID;
                }),

            DeltaPart: (sessionID: MessageV2.SessionID, messageID: MessageV2.MessageID, partID: MessageV2.PartID, field: string, delta: string) => 
                Effect.gen(function* () {
                    yield* events.publish({
                        aggregateID: sessionID,
                        type: "message.part.delta",
                        data: {
                            SessionID: sessionID,
                            MessageID: messageID,
                            PartID: partID,
                            Field: field,
                            Delta: delta,
                        }
                    })
                })
        });
    })
);
