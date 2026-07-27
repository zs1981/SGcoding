import {
    sqliteTable,
    text,
    integer,
    index,
    uniqueIndex
} from "drizzle-orm/sqlite-core";

export const SessionTable = sqliteTable("session", {
    id: text("id").primaryKey(),
    title: text("title").notNull().default(" "),
    timeCreate: integer("time_create").notNull(),
    timeArchived: integer("time_archived")
});

export const SessionMessageTable = sqliteTable("session_message", {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull().references(
        () => SessionTable.id, {
            onDelete: "cascade"
        }
    ),
    role: text("role").notNull(),
    content: text("content").notNull(),
    status: text("status").notNull().default("success"),
    error: text("error"),
    seq: integer("seq").notNull(),
    timeCreate: integer("time_create").notNull()
    }, (table) => [
        uniqueIndex("session_message_session_seq_idx").on(table.sessionId, table.seq),

        index("session_message_session_id_idx").on(table.sessionId)
    ]
);

export const EventSequenceTable = sqliteTable("event_sequence", {
    aggregateId: text("aggregate_id").primaryKey(),
    seq: integer("seq").notNull()
});

export const EventTable = sqliteTable("event", {
    id: text("id").primaryKey(),
    aggregateId: text("aggregate_id").notNull().references(
        () => EventSequenceTable.aggregateId, {
            onDelete: "cascade"
        }
    ),
    seq: integer("seq").notNull(),
    type: text("type").notNull(),
    data: text("data", {mode: "json"}).notNull()
}, (table) =>[
    uniqueIndex("event_aggregate_seq_idx")
        .on(table.aggregateId, table.seq)
])