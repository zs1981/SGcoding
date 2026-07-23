import { asc, eq, isNull, and} from "drizzle-orm";
import type { AppDatabase } from "../database/database.js";
import {
    SessionMessageTable,
    SessionTable,
} from "../database/schema.js"

export type SessionItem = Pick<
    typeof SessionTable.$inferInsert,
    "id" | "title" | "timeCreate"
>;
export type SessionMessage = typeof SessionMessageTable.$inferInsert;

export class SessionStore {
    constructor(private readonly db: AppDatabase) {};

    list() : SessionItem[] {
        return this.db
            .select({
                id: SessionTable.id,
                title: SessionTable.title,
                timeCreate: SessionTable.timeCreate,
            })
            .from(SessionTable)
            .where(isNull(SessionTable.timeArchived))
            .orderBy(asc(SessionTable.timeCreate))
            .all()
    }

    context(sessionId: string): SessionMessage[] {
        const session = this.db
            .select()
            .from(SessionTable)
            .where(and(
                isNull(SessionTable.timeArchived),
                eq(SessionTable.id, sessionId)
            ))
            .get();

        if (!session) {
            throw new Error("No Session Or Achived Session");
        }

        return this.db
            .select()
            .from(SessionMessageTable)
            .where(eq(SessionMessageTable.sessionId, sessionId))
            .orderBy(SessionMessageTable.seq)
            .all()
    }


}