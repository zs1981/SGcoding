import type { CliOptions } from "../../cliArgs.js";
import type { Runtime } from "../../runtime.js"

type DeleteData = Extract<
    CliOptions,
    { command: "delete"}
>["sessionId"];

export function deleteCommand(
    runtime: Runtime,
    sessionId: DeleteData,
): void{
    runtime.sessions.deleteSession(sessionId);
}