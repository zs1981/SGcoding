import { fileURLToPath } from "node:url";
import {
    connectDatabase,
    type AppDatabase,
    type Client,
} from "./database/database.js";
import { EventService } from "./event/service.js";
import { SessionService } from "./session/service.js";
import { SessionStore } from "./session/store.js";

export interface Runtime {
    db: AppDatabase,
    client: Client,
    events: EventService,
    sessions: SessionService,
    store: SessionStore,
}

export function createRuntime(): Runtime {
    const databasePath = fileURLToPath(
        new URL("../data/sgcoding.db", import.meta.url)
    );

    const { db, client } = connectDatabase(databasePath);
    
    const events = new EventService(db);
    const sessions = new SessionService(events);
    const store = new SessionStore(db);

    return {
        db,
        client,
        events,
        sessions,
        store,
    };
}