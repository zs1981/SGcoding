import { MessageV2 } from "../session/message-v2.js";
import { eq } from "drizzle-orm";
import { Context, Effect, Layer, PubSub, Stream} from "effect";
import {
    EventSequenceTable,
    EventTable
} from "../database/schema.js";
import { projectSessionEvent } from "../session/projector.js";
import  {
    type Event,
    type EventType,
    type Publish,
    type PersistentPublish,
    type Payload,
    type PayloadOf,
    isPersistentPublish
} from "./type.js";
import { Database } from "../database/index.js";

export interface Interface {
    readonly publish: (input: Publish) => Effect.Effect<Payload, never, never>;

    readonly subscribe: <T extends EventType>(type: T) => Stream.Stream<PayloadOf<T>>;

    readonly all: () => Stream.Stream<Payload>;
}

export class Service extends Context.Service<
    Service,
    Interface
>()("sgcoding/Event") {}

export const layer = Layer.effect(
    Service,
    Effect.gen(function* () {
        const { db } = yield* Database.Service;

        const allEvents = yield* PubSub.unbounded<Payload>();

        const typed = new Map<EventType, PubSub.PubSub<Payload>>();

        yield* Effect.addFinalizer(() =>
            Effect.gen(function* (){
                yield* PubSub.shutdown(allEvents);

                yield* Effect.forEach(
                    typed.values(),
                    PubSub.shutdown,
                    { discard: true },
                );
            }),
        );

        const getOrCreate = (type: EventType) =>
            Effect.gen(function* () {
                const existing = typed.get(type);

                if (existing) return existing;

                const pubsub = yield* PubSub.unbounded<Payload>();

                typed.set(type, pubsub);
                
                return pubsub;
            });

        const persist = (
            input: PersistentPublish,
        ): Effect.Effect<Event> => 
            Effect.sync(() => 
                db.transaction((tx) => {
                    const current = tx 
                        .select({seq: EventSequenceTable.seq})
                        .from(EventSequenceTable)
                        .where(
                            eq(EventSequenceTable.aggregateId, input.aggregateId)
                        )
                        .get();

                    const event = {
                        ...input,
                        eventId: MessageV2.EventID.ascending(),
                        seq: (current?.seq ?? -1) + 1,
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
                            set: { seq: event.seq } 
                        })
                        .run();

                    tx
                        .insert(EventTable)
                        .values(event)
                        .run();
                
                    return event;
                }),
            );

        const notifiy = (payload: Payload): Effect.Effect<void> => 
            Effect.gen(function* () {
                const pubsub = typed.get(payload.type);

                if (pubsub) {
                    yield* PubSub.publish(pubsub, payload);
                }

                yield* PubSub.publish(allEvents, payload);
            })

        return Service.of({
            publish: (input: Publish) => Effect.gen(function* () {
                let payload: Payload;

                if (isPersistentPublish(input)) {
                    payload = yield* persist(input);
                } else {
                    payload = {
                        ...input,
                        eventId: MessageV2.EventID.ascending(),
                    }
                }

                yield* notifiy(payload);

                return payload;
            }),

            subscribe: <T extends EventType>(type: T) => Stream.unwrap(
                getOrCreate(type).pipe(
                    Effect.map((pubsub) => 
                        Stream.fromPubSub(pubsub),
                    ),
                ),
            ).pipe(
                Stream.map((payload) => payload as PayloadOf<T>),
            ),

            all: (): Stream.Stream<Payload> => Stream.fromPubSub(allEvents),
        });
    }),
);

export const defaultLayer = layer.pipe(
    Layer.provide(Database.defaultLayer)
)

export const testLayer = layer.pipe(
    Layer.provideMerge(Database.testLayer)
)