import { Database } from "../database/index.js";

export interface EventDataByType {
    "session.created": {
        title: string;
        timeCreate:number;
    };

    "message.append": {
        messageId: string;
        role: "user" | "assistant";
        content: string;
        status?: "success" | "error";
        error?: string | null;
        timeCreate: number;
    };

    "step.failed": {
        messageId: string;
        error: string;
    }

    "session.archived": {
        timeArchived: number;
    };

    "session.unarchived": Record<string, never>;

    "session.deleted": Record<string, never>;

    "title.set": {
        title: string,
    }
}

export type EventType = keyof EventDataByType;

type EventOf<T extends EventType> = {
    eventId: string;
    aggregateId: string;
    seq: number;
    type: T;
    data: EventDataByType[T];
};

export type Event = {
    [T in EventType]: EventOf<T>;
}[EventType];

type PublishOf<T extends EventType> = {
    aggregateId: string;
    type: T;
    data: EventDataByType[T];
}

export type Publish = {
    [T in EventType]: PublishOf<T>
}[EventType];

export type EventTransaction = Parameters<
    Parameters<Database.AppDatabase["transaction"]>[0]
>[0];
