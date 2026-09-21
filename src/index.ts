#!/usr/bin/env node
import { runCommand } from "./command/run.js";
import { archiveCommand, unarchiveCommand } from "./command/session/archive.js"
import { deleteCommand } from "./command/session/delete.js";
import { parseArgs } from "./cliArgs.js";
import { createRuntime } from "./runtime.js";
import { listCommand } from "./command/session/list.js";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { fileURLToPath } from "node:url";

async function main(): Promise<void> {
    const options = parseArgs(process.argv.slice(2));
    const runtime = createRuntime({
        databasePath: ":memory:",
        askModel: async () => "pong"
    });

    try {
        migrate(runtime.db, {
            migrationsFolder: fileURLToPath(
                new URL("../drizzle/", import.meta.url)
            ),
        });


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