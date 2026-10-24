import { Schema } from "effect";
import * as Event from "./schema.js";
import { MessageV2 } from "../../session/message-v2.js";

export const CreateSession = Event.define({
    type: "session.create",
    aggregateSchema: MessageV2.SessionID,
    dataSchema: Schema.Struct({
        title: Schema.String,
        timeCreate: Schema.Number,
        SessionID: MessageV2.SessionID,
    }),
    persistent: true,
});

export const ArchiveSession = Event.define({
    type: "session.archive",
    aggregateSchema: MessageV2.SessionID,
    dataSchema: Schema.Struct({
        timeArchived: Schema.Number,
        SessionID: MessageV2.SessionID,
    }),
    persistent: true,
});

export const UnarchiveSession = Event.define({
    type: "session.unarchive",
    aggregateSchema: MessageV2.SessionID,
    dataSchema: Schema.Struct({
        SessionID: MessageV2.SessionID,
    }),
    persistent: true,
});

export const DeleteSession = Event.define({
    type: "session.delete",
    aggregateSchema: MessageV2.SessionID,
    dataSchema: Schema.Struct({
        SessionID: MessageV2.SessionID,
    }),
    persistent: true,
});

export const TitleSet = Event.define({
    type: "title.set",
    aggregateSchema: MessageV2.SessionID,
    dataSchema: Schema.Struct({
        Title: Schema.String,
        SessionID: MessageV2.SessionID,
    }),
    persistent: true,
});

export const UpdateMessage = Event.define({
    type: "message.update",
    aggregateSchema: MessageV2.SessionID,
    dataSchema: Schema.Struct({
        SessionID: MessageV2.SessionID,
        Info: MessageV2.Info,
    }),
    persistent: true,
});

export const RemoveMessage = Event.define({
    type: "message.remove",
    aggregateSchema: MessageV2.SessionID,
    dataSchema: Schema.Struct({
        SessionID: MessageV2.SessionID,
        MessageID: MessageV2.MessageID,
    }),
    persistent: true
});

export const UpdatePart = Event.define({
    type: "message.part.update",
    aggregateSchema: MessageV2.SessionID,
    dataSchema: Schema.Struct({
        SessionID: MessageV2.SessionID,
        MessageID: MessageV2.MessageID,
        Part: MessageV2.Part,
        Time: Schema.Number,
    }),
    persistent: true,
});

export const RemovePart = Event.define({
    type: "message.part.remove",
    aggregateSchema: MessageV2.SessionID,
    dataSchema: Schema.Struct({
        SessionID: MessageV2.SessionID,
        MessageID: MessageV2.MessageID,
        PartID: MessageV2.PartID,
    }),
    persistent: true,
});

export const DeltaPart = Event.define({
    type: "message.part.delta",
    aggregateSchema: MessageV2.SessionID,
    dataSchema: Schema.Struct({
        SessionID: MessageV2.SessionID,
        MessageID: MessageV2.MessageID,
        PartID: MessageV2.PartID,
        Field: Schema.String,
        Delta: Schema.String,
    }),
    persistent: false,
});

export const definitions = [
    CreateSession,
    ArchiveSession,
    UnarchiveSession,
    DeleteSession,
    TitleSet,
    UpdateMessage,
    RemoveMessage,
    UpdatePart,
    RemovePart,
    DeltaPart,
] as const;

export type Definition = (typeof definitions)[number];

export type Publish = Event.Publish<Definition>;

export type Payload = Event.Payload<Definition>;

export type PersistentPayload = Extract<Payload, { readonly seq: number }>;
