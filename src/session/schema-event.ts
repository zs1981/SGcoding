import { Schema } from "effect";
import * as Event from "../event/definitions.js";
import { MessageV2 } from "./message-v2.js";

const durable = {
    aggregate: MessageV2.SessionID,
    persistent: true,
} as const;

const Empty = Schema.Record(
    Schema.String,
    Schema.Never,
);

export const Created = Event.define({
    ...durable,
    type: "session.created",
    schema: Schema.Struct({
        title: Schema.String,
        timeCreate: Schema.Number,
    }),
    aggreagte: undefined
});

export const Archived = Event.define({
    ...durable,
    type: "session.archived",
    schema: Schema.Struct({
        timeArchived: Schema.Number,
    }),
});

export const Unarchived = Event.define({
    ...durable,
    type: "session.unarchived",
    schema: Empty,
});

export const Deleted = Event.define({
    ...durable,
    type: "session.deleted",
    schema: Empty,
});

export const TitleSet = Event.define({
    ...durable,
    type: "title.set",
    schema: Schema.Struct({
        title: Schema.String,
    }),
});

export const MessageUpdated = Event.define({
    ...durable,
    type: "message.updated",
    schema: Schema.Struct({
        info: MessageV2.Info,
    }),
});

export const MessageRemoved = Event.define({
    ...durable,
    type: "message.removed",
    schema: Schema.Struct({
        sessionID: MessageV2.SessionID,
        messageID: MessageV2.MessageID,
    }),
});

export const PartUpdated = Event.define({
    ...durable,
    type: "message.part.updated",
    schema: Schema.Struct({
        part: MessageV2.Part,
        time: Schema.Number,
    }),
});

export const PartRemoved = Event.define({
    ...durable,
    type: "message.part.removed",
    schema: Schema.Struct({
        sessionID: MessageV2.SessionID,
        messageID: MessageV2.MessageID,
        partID: MessageV2.PartID,
    }),
});

export const PartDelta = Event.define({
    type: "message.part.delta",
    aggregate: MessageV2.SessionID,
    persistent: false,
    schema: Schema.Struct({
        sessionID: MessageV2.SessionID,
        messageID: MessageV2.MessageID,
        partID: MessageV2.PartID,
        field: Schema.String,
        delta: Schema.String,
    }),
});

export const definitions = [
    Created,
    Archived,
    Unarchived,
    Deleted,
    TitleSet,
    MessageUpdated,
    MessageRemoved,
    PartUpdated,
    PartRemoved,
    PartDelta,
] as const;

export type Definition =
    (typeof definitions)[number];

export type Payload =
    Event.Payload<Definition>;

export type PersistentPayload =
    Extract<Payload, { readonly seq: number }>;