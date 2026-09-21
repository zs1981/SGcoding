import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

export function connectDatabase(DatabasePath?: string) {
    const client = new Database(DatabasePath);

    client.pragma("foreign_keys = ON");
    client.pragma("journal_mode = WAL");
    client.pragma("synchronous = NORMAL");
    client.pragma("busy_timeout = 5000")

    const db = drizzle({
        client,
        schema
    });

    return {
        client,
        db
    };
}

type DatabaseConnect = ReturnType<typeof connectDatabase>;

export type Client = DatabaseConnect['client'];
export type AppDatabase = DatabaseConnect["db"]