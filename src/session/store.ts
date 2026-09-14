import { desc, eq, isNull, and} from "drizzle-orm";
import type { AppDatabase } from "../database/database.js";
import {
    SessionMessageTable,
    SessionTable,
} from "../database/schema.js"
import { title } from "node:process";

export type SessionItem = Pick<
    typeof SessionTable.$inferSelect,
    "id" | "title" | "timeCreate" | "timeArchived"
>;
export type SessionMessage = typeof SessionMessageTable.$inferSelect;



export class SessionStore {
    constructor(private readonly db: AppDatabase) {};

    get(sessionId: string): SessionItem | undefined {
        return this.db
            .select({
                id: SessionTable.id,
                title: SessionTable.title,
                timeCreate: SessionTable.timeCreate,
                timeArchived: SessionTable.timeArchived
            })
            .from(SessionTable)
            .where(eq(SessionTable.id, sessionId))
            .get();
    }

    list(maxCount: number, includeArchived: boolean) : SessionItem[] {
        return this.db
            .select({
                id: SessionTable.id,
                title: SessionTable.title,
                timeCreate: SessionTable.timeCreate,
                timeArchived: SessionTable.timeArchived,
            })
            .from(SessionTable)
            .where(includeArchived ? undefined : isNull(SessionTable.timeArchived))
            .orderBy(desc(SessionTable.timeCreate))
            .limit(maxCount)
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