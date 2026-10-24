import { eq, and } from "drizzle-orm";
import {
    SessionTable,
    MessageTable,
    PartTable,
} from "../database/schema.js";
import type {
    EventTransaction,
    Projector as EventProjector
} from "../event/service.js";
import { PersistentPayload } from "../event/schema/schema-event.js"


export function projectSessionEvent(
    tx: EventTransaction,
    event: PersistentPayload,
): void {
    switch (event.type) {
        case "session.create" : {
            tx
                .insert(SessionTable)
                .values({
                    id: event.aggregateID,
                    title: event.data.title,
                    timeCreate: event.data.timeCreate,
                })
                .run();
        
            return;
        }

        case "session.archive": {
            tx
                .update(SessionTable)
                .set({
                    timeArchived: event.data.timeArchived,
                })
                .where(eq(SessionTable.id, event.aggregateID))
                .run();

            return;
        }

        case "session.unarchive": {
            tx
                .update(SessionTable)
                .set({
                    timeArchived: null,
                })
                .where(eq(SessionTable.id, event.aggregateID))
                .run();
            
            return;
        }

        case "session.delete": {
            tx
                .delete(SessionTable)
                .where(eq(SessionTable.id, event.aggregateID))
                .run();
        
            return;
        }

        case "title.set": {
            tx
                .update(SessionTable)
                .set({
                    title: event.data.Title,
                })
                .where(eq(SessionTable.id, event.aggregateID))
                .run();

            return;
        }

        case "message.update": {
            const {
                id,
                sessionID,
                ...data
            } = event.data.Info;

            tx
                .insert(MessageTable)
                .values({
                    id: id,
                    session_id: sessionID,
                    time_created: event.data.Info.time.created,
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

        case "message.remove": {
            tx 
                .delete(MessageTable)
                .where(
                    and(
                        eq(
                            MessageTable.session_id,
                            event.data.SessionID,
                        ),
                        eq(
                            MessageTable.id,
                            event.data.MessageID,
                        ),
                    ),
                )
                .run()
            
            return;
        }

        case "message.part.update": {
            const {
                id,
                sessionID,
                messageID,
                ...data
            } = event.data.Part

            tx
                .insert(PartTable)
                .values({
                    id,
                    session_id: sessionID,
                    message_id: messageID,
                    time_created: event.data.Time,
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

        case "message.part.remove": {
            tx
                .delete(PartTable)
                .where(
                    and(
                        eq(
                            PartTable.session_id,
                            event.data.SessionID,
                        ),
                        eq(
                            PartTable.message_id,
                            event.data.MessageID,
                        ),
                        eq(
                            PartTable.id,
                            event.data.PartID,
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

export const Projector: EventProjector = {
    project: projectSessionEvent,
}