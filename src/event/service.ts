import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { Context, Data, Effect, Layer} from "effect";
import {
    EventSequenceTable,
    EventTable
} from "../database/schema.js";
import { projectSessionEvent } from "../session/projector.js";
import type {
    Event,
    Publish
} from "../event/type.js";
import { Database } from "../database/index.js";

export interface Interface {
    readonly publish: (input: Publish) => Effect.Effect<Event, never, never>;
}

export class Service extends Context.Service<
    Service,
    Interface
>()("sgcoding/Event") {}

export const layer = Layer.effect(
    Service,
    Effect.gen(function* () {
        const { db } = yield* Database.Service;

        const publish = (input: Publish): Effect.Effect<Event, never, never> => 
            Effect.sync(() => 
                db.transaction((tx) => {
                    const current = tx
                        .select({seq: EventSequenceTable.seq})
                        .from(EventSequenceTable)
                        .where(eq(EventSequenceTable.aggregateId, input.aggregateId))
                        .get()
                        
                    const seq = (current?.seq ?? -1) + 1;

                    const event = {
                        eventId: `evt_${randomUUID()}`,
                        aggregateId: input.aggregateId,
                        seq: seq,
                        type: input.type,
                        data: input.data,
                    } as Event
                        
                    projectSessionEvent(tx, event);

                    tx.insert(EventSequenceTable)
                        .values({
                            aggregateId: event.aggregateId,
                            seq: event.seq,
                        })
                        .onConflictDoUpdate({
                            target: EventSequenceTable.aggregateId,
                            set: { seq: event.seq},
                        })
                        .run();

                    tx.insert(EventTable)
                        .values(event)
                        .run();

                    return event;
                }) 
            )

        return {publish};
    })
);

export const defaultLayer = layer.pipe(
    Layer.provide(Database.defaultLayer)
)
export const testLayer = layer.pipe(
    Layer.provideMerge(Database.testLayer)
)