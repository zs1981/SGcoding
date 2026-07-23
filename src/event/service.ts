import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
    EventSequenceTable,
    EventTable
} from "../database/schema.js";
import type { AppDatabase } from "../database/database.js";
import { projectSessionEvent } from "../session/projector.js";
import type {
    Event,
    Publish
} from "../event/type.js";

export class EventService {
    constructor(private readonly db: AppDatabase) {}

    publish(input: Publish): Event {
        return this.db.transaction((tx) => {
            const current = tx
                .select({seq: EventSequenceTable.seq})
                .from(EventSequenceTable)
                .where(eq(EventSequenceTable.aggregateId, input.aggrateId))
                .get();
            
            const seq = (current?.seq ?? -1) + 1;

            const event = {
                id: `evt_${randomUUID()}`,
                aggregateId: input.aggrateId,
                seq: seq,
                type: input.type,
                data: input.data,
            } as Event;

            projectSessionEvent(tx, event);

            tx
                .insert(EventSequenceTable)
                .values({
                    aggregateId: event.aggregateId,
                    seq: event.seq,
                })
                .onConflictDoUpdate({
                    target: EventSequenceTable.aggregateId,
                    set: {
                        seq: event.seq,
                    },
                })
                .run();
            
            tx.insert(EventTable).values(event).run();

            return event;
        })
    }
}