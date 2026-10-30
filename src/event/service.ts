import { eq } from "drizzle-orm";
import { Context, Effect, Layer, PubSub, Stream } from "effect";

import { Database } from "../database/index.js";
import { 
    EventSequenceTable,
    EventTable
} from "../database/schema.js";
import {
    type Definition, 
    type Publish,
    type Payload, 
    type PersistentPayload, 
    definitions
} from "./schema/event.js";
import { EventID, EventTransaction } from "./schema/schema.js";


export interface Interface {
    readonly publish: (input: Publish) => Effect.Effect<Payload>;

    readonly subscribe: (type: Definition["type"]) => Stream.Stream<Extract<Payload, { readonly type: typeof type}>>

    readonly all: () => Stream.Stream<Payload>;
}

export interface Projector {
    readonly project: (
        tx: EventTransaction,
        event: PersistentPayload,
    ) => void;
}

export interface Config<Identifier> {
    readonly service: Context.Service<Identifier, Interface>;
    readonly projectors?: ReadonlyArray<Projector>;
}

export function EventLayer<Identifier>(
    config: Config<Identifier>,
) {
    return Layer.effect(
        config.service,
        Effect.gen(function*() {
            const { db } = yield* Database.Service;

            const bus = yield* Effect.acquireRelease(
                PubSub.unbounded<Payload>(),
                (bus) => PubSub.shutdown(bus),
            );

            const persist = (
                input: Publish,
            ): PersistentPayload => 
                db.transaction((tx) => {
                    const current = tx 
                        .select({ seq: EventSequenceTable.seq})
                        .from(EventSequenceTable)
                        .where(eq(
                            EventSequenceTable.aggregateId, input.aggregateID,
                        ))
                        .get();
                    
                    const PersistentPayload = {
                        ...input,
                        seq: (current?.seq ?? -1) + 1,
                        eventID: EventID.ascending()
                    } as PersistentPayload
                    
                    for (const projector of config.projectors ?? []) {
                        projector.project(tx, PersistentPayload)
                    }
                    
                    tx
                        .insert(EventSequenceTable)
                        .values({
                            aggregateId: PersistentPayload.aggregateID,
                            seq: PersistentPayload.seq,
                        })
                        .onConflictDoUpdate({
                            target: EventSequenceTable.aggregateId,
                            set: { seq: PersistentPayload.seq },
                        })
                        .run();

                    tx
                        .insert(EventTable)
                        .values({
                            eventId: PersistentPayload.eventID,
                            aggregateId: PersistentPayload.aggregateID,
                            seq: PersistentPayload.seq,
                            type: PersistentPayload.type,
                            data: PersistentPayload.data,
                        })
                        .run();

                    return PersistentPayload;
                })

            return config.service.of({
                publish: (input) => 
                    Effect.gen(function* () {
                        const definition = definitions.find(
                            (definition) => input.type === definition.type
                        );

                        let payload;

                        if (definition?.persistent) {
                            payload = persist(input);
                        } else {
                            payload = {
                                ...input,
                                eventID: EventID.ascending(),
                            } as Payload
                        }

                        yield* PubSub.publish(bus, payload);

                        return payload;
                    }),
                
                subscribe: (type) => 
                    Stream.fromPubSub(bus).pipe(
                        Stream.filter((event) => event?.type === type),
                    ), 

                all: () => Stream.fromPubSub(bus),
            })
        }),
    )
}

