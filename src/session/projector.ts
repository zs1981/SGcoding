import { eq, and } from "drizzle-orm";
import {
    SessionTable,
    MessageTable,
    PartTable,
} from "../database/schema.js";
import type {
    Event,
    EventTransaction,
} from "../event/type.js";

export function projectSessionEvent(
    tx: EventTransaction,
    event: Event
): void {
    switch (event.type) {
        case "session.created" : {
            tx
                .insert(SessionTable)
                .values({
                    id: event.aggregateId,
                    title: event.data.title,
                    timeCreate: event.data.timeCreate,
                })
                .run();
        
            return;
        }

        case "session.archived": {
            tx
                .update(SessionTable)
                .set({
                    timeArchived: event.data.timeArchived,
                })
                .where(eq(SessionTable.id, event.aggregateId))
                .run();

            return;
        }

        case "session.unarchived": {
            tx
                .update(SessionTable)
                .set({
                    timeArchived: null,
                })
                .where(eq(SessionTable.id, event.aggregateId))
                .run();
            
            return;
        }

        case "session.deleted": {
            tx
                .delete(SessionTable)
                .where(eq(SessionTable.id, event.aggregateId))
                .run();
        
            return;
        }

        case "title.set": {
            tx
                .update(SessionTable)
                .set({
                    title: event.data.title,
                })
                .where(eq(SessionTable.id, event.aggregateId))
                .run();

            return;
        }

        case "message.updated": {
            const {
                id,
                sessionID,
                ...data
            } = event.data.info;

            tx
                .insert(MessageTable)
                .values({
                    id: id,
                    session_id: sessionID,
                    time_created: event.data.info.time.created,
                    data: data,
                })
                .onConflictDoUpdate({
                    target: MessageTable.id,
                    set: {
                        data,
                    },
                })
                .run();

            return;
        }

        case "message.removed": {
            tx 
                .delete(MessageTable)
                .where(
                    and(
                        eq(
                            MessageTable.session_id,
                            event.data.sessionID,
                        ),
                        eq(
                            MessageTable.id,
                            event.data.messageID,
                        ),
                    ),
                )
                .run()
            
            return;
        }

        case "message.part.updated": {
            const {
                id,
                sessionID,
                messageID,
                ...data
            } = event.data.part

            tx
                .insert(PartTable)
                .values({
                    id,
                    session_id: sessionID,
                    message_id: messageID,
                    time_created: event.data.time,
                    data,
                })
                .onConflictDoUpdate({
                    target: PartTable.id,
                    set: {
                        data,
                        },
                })
                .run();

            return;
        }

        case "message.part.removed": {
            tx
                .delete(PartTable)
                .where(
                    and(
                        eq(
                            PartTable.session_id,
                            event.data.sessionID,
                        ),
                        eq(
                            PartTable.message_id,
                            event.data.messageID,
                        ),
                        eq(
                            PartTable.id,
                            event.data.partID,
                        ),
                    ),
                )
                .run();

            return;
        }

        default: {
            const unhandledEvent: never = event;
            throw new Error(`Unhandled Event: ${unhandledEvent}`);
        }
    }
}