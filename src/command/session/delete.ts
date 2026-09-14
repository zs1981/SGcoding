import type { CliOptions } from "../../cliArgs.js";
import type { Runtime } from "../../runtime.js"
import { SessionNotFoundError } from "../../session/error.js";

type DeleteData = Extract<
    CliOptions,
    { command: "delete"}
>["data"];

export function deleteCommand(
    runtime: Runtime,
    data: DeleteData,
): void{
    if (!runtime.store.get(data.sessionId)) {
        throw new SessionNotFoundError(data.sessionId);
    }

    runtime.sessions.deleteSession(data.sessionId);
}