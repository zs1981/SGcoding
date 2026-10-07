import { Database} from "./database/index.js"
import { EventService } from "./event/service.js";
import { SessionService } from "./session/service.js";
import { SessionStore } from "./session/store.js";
import { askModel } from "./model/index.js";
import { Effect } from "effect";

export interface Runtime {
    db: Database.AppDatabase,
    client: Database.Client,
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
    options: RuntimeOptions = {}
): Effect.Effect<Runtime, never, Database.Service> {
    return Effect.gen(function* () {
        const {db, client} = yield* Database.Service;

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
    });
}