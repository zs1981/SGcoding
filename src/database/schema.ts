import {
    sqliteTable,
    text,
    integer,
    index,
    uniqueIndex
} from "drizzle-orm/sqlite-core";
import { type MessageV2 } from "../session/message-v2.js";

export const SessionTable = sqliteTable(
    "session",
    {
    id: text("id").$type<MessageV2.SessionID>().primaryKey(),
    title: text("title").notNull().default(""),
    timeCreate: integer("time_create").notNull(),
    timeArchived: integer("time_archived")
    }
);

export const EventSequenceTable = sqliteTable(
    "event_sequence",
    {
    aggregateId: text("aggregate_id").primaryKey(),
    seq: integer("seq").notNull()
    }
);

export const EventTable = sqliteTable(
    "event",
    {
    eventId: text("id").primaryKey(),
    aggregateId: text("aggregate_id").notNull().references(
        () => EventSequenceTable.aggregateId, {
            onDelete: "cascade"
        }
    ),
    seq: integer("seq").notNull(),
    type: text("type").notNull(),
    data: text("data", {mode: "json"}).notNull()
    },
    (table) =>[
        uniqueIndex("event_aggregate_seq_idx")
            .on(table.aggregateId, table.seq)
    ],
);

type DistributiveOmit<T, K extends PropertyKey> =
    T extends unknown ? Omit<T, K> : never;

type MessageData = DistributiveOmit<
    MessageV2.Info,
    "id" | "sessionID"
>;

type PartData = DistributiveOmit<
    MessageV2.Part,
    "id" | "sessionID" | "messageID"
>;

const Timestamps = {
    time_created: integer("time_created")
        .notNull()
        .$default(() => Date.now()),

    time_updated: integer("time_updated")
        .notNull()
        .$onUpdate(() => Date.now()),
};

export const MessageTable = sqliteTable(
    "message",
    {
        id: text("id")
            .$type<MessageV2.MessageID>()
            .primaryKey(),
        
        session_id: text("session_id")
            .$type<MessageV2.SessionID>()
            .notNull()
            .references(
                () => SessionTable.id,
                {
                    onDelete: "cascade",
                },
            ),
        
        ...Timestamps,

        data: text("data", {mode: "json"})
            .notNull()
            .$type<MessageData>(),
    },
    (table) => [
        index("message_session_time_created_id_idx")
            .on(
                table.session_id,
                table.time_created,
                table.id,
            ),
    ],
);

export const PartTable = sqliteTable(
    "part",
    {
        id: text("id")
            .$type<MessageV2.PartID>()
            .primaryKey(),

        message_id: text("message_id")
            .$type<MessageV2.MessageID>()
            .notNull()
            .references(
                () => MessageTable.id,
                {
                    onDelete: "cascade",
                }
            ),

        session_id: text("session_id")
            .$type<MessageV2.SessionID>()
            .notNull(),

        ...Timestamps,

        data: text("data", {mode: "json",})
            .notNull()
            .$type<PartData>(),
    },
    (table) => [
        index("part_message_id_idx")
            .on(
                table.message_id,
                table.id
            ),
        
        index("part_session_idx")
            .on(
                table.session_id,
            )
    ],
);
