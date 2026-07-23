#!/usr/bin/env node
import { chatCommand } from "./command/chat.js";
import { archiveCommand } from "./command/archive.js"
import { createCommand } from "./command/create.js";
import { deleteCommand } from "./command/delete.js";
import { parseArgs } from "./cliArgs.js";
import { createRuntime } from "./runtime.js";
import { run } from "node:test";

async function main(): Promise<void> {
    const options = parseArgs(process.argv.slice(2));
    const runtime = createRuntime();

    try {
        switch (options.command) {
            case "create": {
                createCommand(runtime, options.title);

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

            case "chat": {
                await chatCommand(
                    runtime,
                    options.data,
                );

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