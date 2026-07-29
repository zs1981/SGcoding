import type { CliOptions } from "../../cliArgs.js";
import type { Runtime } from "../../runtime.js"
import { SessionNotFoundError } from "../../session/error.js";

type DeleteData = Extract<
    CliOptions,
    { command: "delete"}
>["sessionId"];

export function deleteCommand(
    runtime: Runtime,
    sessionId: DeleteData,
): void{
    if (!runtime.store.get(sessionId)) {
        throw new SessionNotFoundError(sessionId);
    }

    runtime.sessions.deleteSession(sessionId);
}