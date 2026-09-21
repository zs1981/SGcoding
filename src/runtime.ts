import { resolveDatabasePath } from "./database/path.js";
import {
    connectDatabase,
    type AppDatabase,
    type Client,
} from "./database/database.js";
import { EventService } from "./event/service.js";
import { SessionService } from "./session/service.js";
import { SessionStore } from "./session/store.js";
import { askModel } from "./model/index.js";

export interface Runtime {
    db: AppDatabase,
    client: Client,
    events: EventService,
    sessions: SessionService,
    store: SessionStore,
    askModel: typeof askModel;
}

export type RuntimeOptions = {
    databasePath?: string;
    askModel?: typeof askModel;
}

export function createRuntime(
    options : RuntimeOptions = {},
): Runtime {
    const databasePath = resolveDatabasePath(options.databasePath);

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
        askModel: options.askModel ?? askModel,
    };
}