import { and, desc, eq, isNull } from "drizzle-orm";
import { Context, Effect, Layer} from "effect";
import { Database } from "../database/index.js";
import {
    SessionMessageTable,
    SessionTable,
} from "../database/schema.js";
import { SessionNotFoundError } from "./error.js";
import { effect } from "effect/Layer";


export type SessionItem = typeof SessionTable.$inferSelect;


export type SessionMessage = typeof SessionMessageTable.$inferSelect;

export interface Interface {
    readonly get: (sessionID: string) => Effect.Effect<SessionItem | undefined>;

    readonly list: (maxCount: number, includeArchived: boolean) => Effect.Effect<SessionItem[]>;

    readonly context: (sesssionID: string) => Effect.Effect<SessionMessage[], Error>;
}

export class Service extends Context.Service<
    Service,
    Interface
>()("sgcoding/Store") {}

export const layer = Layer.effect(
    Service,
    Effect.gen(function* () {
        const { db } = yield* Database.Service;

        return Service.of({
            get: (sessionID: string) => 
                Effect.sync(() => 
                    db.select()
                    .from(SessionTable)
                    .where(eq(SessionTable.id, sessionID))
                    .get(),
                ),

            list: (maxCount: number, includeArchived: boolean) => 
                Effect.sync(() => 
                    db.select()
                    .from(SessionTable)
                    .where(
                        includeArchived
                            ? undefined : isNull(SessionTable.timeArchived)
                    )
                    .orderBy(desc(SessionTable.timeCreate))
                    .limit(maxCount)
                    .all(),
                ),

            context: (sessionID: string) =>
                Effect.gen(function* () {
                    const session = yield* Effect.sync(() => 
                        db.select()
                            .from(SessionTable)
                            .where(
                                and(
                                    isNull(SessionTable.timeArchived),
                                    eq(SessionTable.id, sessionID)
                                )
                            )
                            .get()
                    )

                    if (!session) {
                        return yield* Effect.fail(new SessionNotFoundError(sessionID))
                    }

                    return yield* Effect.sync(() => 
                        db.select()
                        .from(SessionMessageTable)
                        .where(eq(SessionMessageTable.sessionId, sessionID))
                        .orderBy(SessionMessageTable.seq)
                        .all()
                    )
                }),
        });
    })
);

export const defaultLayer = layer.pipe(
    Layer.provide(Database.defaultLayer),
)

export const testLayer = layer.pipe(
    Layer.provideMerge(Database.testLayer),
)