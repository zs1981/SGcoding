import type { CliOptions } from "../cliArgs.js";
import type { Runtime } from "../runtime.js"

type CreateData = Extract<
    CliOptions,
    { command: "create"}
>["title"];

export function createCommand(
    runtime: Runtime,
    title: CreateData,
): void{
    runtime.sessions.createSession(title);
}