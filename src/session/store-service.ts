import { desc, eq, isNull, asc } from "drizzle-orm";
import { Context, Effect, Layer} from "effect";
import { Database } from "../database/index.js";
import {
    MessageTable,
    SessionTable,
    PartTable,
} from "../database/schema.js";
import { SessionNotFoundError } from "./error.js";
import { MessageV2 } from "./message-v2.js";

export type SessionItem = typeof SessionTable.$inferSelect;

export interface Interface {
    readonly get: (sessionID: MessageV2.SessionID) => Effect.Effect<SessionItem | undefined>;

    readonly list: (maxCount: number, includeArchived: boolean) => Effect.Effect<SessionItem[]>;

    readonly context: (sessionID: MessageV2.SessionID) => Effect.Effect<MessageV2.WithParts[], SessionNotFoundError>;
}

export class Service extends Context.Service<
    Service,
    Interface
>()("sgcoding/Store") {}

function toPart(
    row: typeof PartTable.$inferSelect,
): MessageV2.Part {
    return {
        ...row.data,
        id: row.id,
        sessionID: row.session_id,
        messageID: row.message_id,
    };
}

function toInfo(
    row: typeof MessageTable.$inferSelect,
): MessageV2.Info {
    return {
        ...row.data,
        id: row.id,
        sessionID: row.session_id,
    };
}

export const layer = Layer.effect(
    Service,
    Effect.gen(function* () {
        const { db } = yield* Database.Service;

        return Service.of({
            get: (sessionID: MessageV2.SessionID) => 
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

            context: (sessionID: MessageV2.SessionID) =>
                Effect.gen(function* () {
                    const session = yield* Effect.sync(() => 
                        db.select()
                            .from(SessionTable)
                            .where(eq(SessionTable.id, sessionID))
                            .get(),
                    );

                    if (!session) {
                        return yield* Effect.fail(new SessionNotFoundError(sessionID));
                    }

                    return yield* Effect.sync(() => {
                        const messageRows = db.select()
                            .from(MessageTable)
                            .where(eq(MessageTable.session_id, sessionID))
                            .orderBy(
                                asc(MessageTable.time_created),
                                asc(MessageTable.id),
                            )
                            .all();
                        
                        if (messageRows.length === 0) {
                            return [];
                        }  

                        const partRows = db
                            .select()
                            .from(PartTable)
                            .where(
                                eq(PartTable.session_id, sessionID)
                            )
                            .orderBy(
                                asc(PartTable.message_id),
                                asc(PartTable.id),
                            )
                            .all();

                        const partsByMessage = new Map<
                            MessageV2.MessageID,
                            MessageV2.Part[]
                        >();

                        for (const row of partRows) {
                            const parts = partsByMessage.get(row.message_id);
                            const part = toPart(row);

                            if (parts) {
                                parts.push(part);
                            } else {
                                partsByMessage.set(row.message_id, [part]);
                            }
                        }

                        return messageRows.map((row) => ({
                            info: toInfo(row),
                            parts: partsByMessage.get(row.id) ?? [],
                        }));
                    });
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
