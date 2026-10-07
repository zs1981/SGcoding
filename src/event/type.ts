import { Database } from "../database/index.js";
import type { MessageV2 } from "../session/message-v2.js";

export * as Type from "./type.js";

export interface EventData{
    "session.created": {
        title: string;
        timeCreate:number;
    };

    "session.archived": {
        timeArchived: number;
    };

    "session.unarchived": Record<string, never>;

    "session.deleted": Record<string, never>;

    "title.set": {
        title: string,
    }

    "message.updated": {
        info: MessageV2.Info;
    }

    "message.removed": {
        sessionID: MessageV2.SessionID;
        messageID: MessageV2.MessageID;
    }

    "message.part.updated": {
        part: MessageV2.Part;
        time: number;
    }

    "message.part.removed": {
        sessionID: MessageV2.SessionID;
        messageID: MessageV2.MessageID;
        partID: MessageV2.PartID;
    }

    "message.part.delta": {
        sessionID: MessageV2.SessionID;
        messageID: MessageV2.MessageID;
        partID: MessageV2.PartID;
        field: string;
        delta: string;
    }
}

export const EventPersistence = {
    "session.created": true,
    "session.archived": true,
    "session.unarchived": true,
    "session.deleted": true,
    "title.set": true,
    "message.updated": true,
    "message.removed": true,
    "message.part.updated": true,
    "message.part.removed": true,
    "message.part.delta": false,
} as const satisfies Record<EventType, boolean>;

export type EventType = keyof EventData;

export type PersistentEventType = {
    [T in EventType]: (typeof EventPersistence)[T] extends true ? T : never;
}[EventType];

export type PublishOf<T extends EventType> = {
    aggregateId: MessageV2.SessionID;
    type: T;
    data: EventData[T];
}

export type Publish = {
    [T in EventType]: PublishOf<T>
}[EventType];

export type PersistentPublish = {
    [T in PersistentEventType]: PublishOf<T>
}[PersistentEventType];

export type PayloadOf<T extends EventType> =
    T extends PersistentEventType
        ? PublishOf<T> & {
        eventId: MessageV2.EventID;
        seq: number;
    }
        : PublishOf<T> & {
        eventId: MessageV2.EventID;
        seq?: never;
    };

export type Payload = {
    [T in EventType]: PayloadOf<T>;
}[EventType];

export type Event = {
    [T in PersistentEventType]: PayloadOf<T>;
}[PersistentEventType]

export function isPersistentPublish(input: Publish): input is PersistentPublish {
    return EventPersistence[input.type];
}

export type EventTransaction = Parameters<
    Parameters<Database.AppDatabase["transaction"]>[0]
>[0];
