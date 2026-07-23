import type { CliOptions } from "../cliArgs.js";
import type { Runtime } from "../runtime.js"

type ArchiveData = Extract<
    CliOptions,
    { command: "archive"}
>["sessionId"];

export function archiveCommand(
    runtime: Runtime,
    sessionId: ArchiveData,
): void{
    runtime.sessions.archiveSession(sessionId);
}