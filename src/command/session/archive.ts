import type { CliOptions } from "../../cliArgs.js";
import type { Runtime } from "../../runtime.js";
import { 
    SessionNotFoundError, 
    SessionArchivedError
} from "../../session/error.js";


type ArchiveData = Extract<
    CliOptions,
    { command: "archive"}
>["data"];

type UnArchiveData = Extract<
    CliOptions,
    { command: "unarchive"}
>["data"];

export function archiveCommand(
    runtime: Runtime,
    data: ArchiveData,
): void{
    const sessionId = data.sessionId;
    const session = runtime.store.get(sessionId);

    if (!session) {
        throw new SessionNotFoundError(sessionId);
    }

    if (session.timeArchived !== null) {
        throw new SessionArchivedError(
        sessionId, session.timeArchived
        );
    }

    runtime.sessions.archiveSession(sessionId);
}

export function unarchiveCommand(
    runtime: Runtime,
    data: UnArchiveData,
): void{
    const sessionId = data.sessionId;

    if (!runtime.store.get(sessionId)) {
        throw new SessionNotFoundError(sessionId);
    }

    runtime.sessions.unarchiveSession(sessionId);
}