#!/usr/bin/env node
import { createRuntime } from "./runtime.js";
import { ManagedRuntime } from "effect";
import { Database } from "./database/index.js";
import { parseArgs } from "./cliArgs.js";
import { archiveCommand, unarchiveCommand } from "./command/session/archive.js"
import { deleteCommand } from "./command/session/delete.js";
import { runCommand } from "./command/run.js";
import { listCommand } from "./command/session/list.js";

async function main(): Promise<void> {
    const options = parseArgs(process.argv.slice(2));
    const appRuntime = ManagedRuntime.make(
        Database.makeLayer(":memory:")
    )
    try {
        const runtime = await appRuntime.runPromise(
            createRuntime({
                askModel: async () => 'pong',
            })
        )

        switch (options.command) {
            case "run": {
                await runCommand(runtime, options.data);

                return;
            }

            case "delete": {
                deleteCommand(runtime, options.data);

                return;
            }

            case "archive": {
                archiveCommand(runtime, options.data);

                return;
            }
            
            case "unarchive": {
                unarchiveCommand(runtime, options.data);

                return;
            }

            case "list": {
                listCommand(runtime, options.data);

                return;
            }

            default: {
                const unhandledOptions: never = options;

                throw new Error(
                    `Unhandled command: ${JSON.stringify(unhandledOptions)}`,
                );
            }

        }
    } finally {
        await appRuntime.dispose();
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
