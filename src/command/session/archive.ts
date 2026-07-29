import type { CliOptions } from "../../cliArgs.js";
import type { Runtime } from "../../runtime.js";
import { 
    SessionNotFoundError, 
    SessionArchivedError
} from "../../session/error.js";


type ArchiveData = Extract<
    CliOptions,
    { command: "archive"}
>["sessionId"];

type UnArchiveData = Extract<
    CliOptions,
    { command: "unarchive"}
>["sessionId"];

export function archiveCommand(
    runtime: Runtime,
    sessionId: ArchiveData,
): void{
    const session = runtime.store.get(sessionId)

    if (!session) {
        throw new SessionNotFoundError(sessionId);
    }

    if (session.timeArchived !== null) {
        throw new SessionArchivedError(
            session.id, session.timeArchived
        );
    }

    runtime.sessions.archiveSession(sessionId);
}

export function unarchiveCommand(
    runtime: Runtime,
    sessionId: UnArchiveData,
): void{
    if (!runtime.store.get(sessionId)) {
        throw new SessionNotFoundError(sessionId);
    }

    runtime.sessions.unarchiveSession(sessionId);
}