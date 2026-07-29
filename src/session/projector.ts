import { eq } from "drizzle-orm";
import {
    SessionMessageTable,
    SessionTable,
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
                    timeCreate: event.data.timeCreate,
                })
                .run();
        
            return;
        }

        case "message.append": {
            tx
                .insert(SessionMessageTable)
                .values({
                    id: event.data.messageId,
                    sessionId: event.aggregateId,
                    role: event.data.role,  
                    content: event.data.content,
                    status: event.data.status,
                    error: event.data.error,
                    seq: event.seq,
                    timeCreate: event.data.timeCreate,
                })
                .run();
                
            return;
        }

        case "step.failed": {
            tx
                .update(SessionMessageTable)
                .set({
                    status: "error",
                    error: event.data.error,
                })
                .where(eq(SessionMessageTable.id, event.data.messageId))
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

        default: {
            const unhandledEvent: never = event;
            throw new Error(`Unhandled Event: ${unhandledEvent}`);
        }
    }
}