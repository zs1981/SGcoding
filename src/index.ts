#!/usr/bin/env node
import { runCommand } from "./command/run.js";
import { archiveCommand } from "./command/session/archive.js"
import { deleteCommand } from "./command/session/delete.js";
import { parseArgs } from "./cliArgs.js";
import { createRuntime } from "./runtime.js";
import { listCommand } from "./command/session/list.js";

async function main(): Promise<void> {
    const options = parseArgs(process.argv.slice(2));
    const runtime = createRuntime();

    try {
        switch (options.command) {
            case "run": {
                await runCommand(runtime, options.data);

                return;
            }

            case "delete": {
                deleteCommand(runtime, options.sessionId);

                return;
            }

            case "archive": {
                archiveCommand(runtime, options.sessionId);

                return;
            }

            case "list": {
                listCommand(runtime);

                return;
            }

        }
    } finally {
        runtime.client.close();
    }
}

main().catch((error: unknown) => {
    console.error(
        error instanceof Error
            ? error.message
            : String(error),
    );

    process.exitCode = 1;
});