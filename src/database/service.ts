import NativeDatabase from "better-sqlite3";
import { 
    drizzle,
    type BetterSQLite3Database
 } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { Context, Effect, Layer } from "effect";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveDatabasePath } from "./path.js";
import * as schema from "./schema.js";
import { toError } from "../util/error.js";

export type Client = InstanceType<typeof NativeDatabase>;
export type AppDatabase = BetterSQLite3Database<typeof schema> & {
    $client: Client;
}

export interface Interface {
    readonly db: AppDatabase;
    readonly client: Client;
}

export class Service extends Context.Service<
    Service,
    Interface
>()("sgcoding/Database") {}

export function makeLayer(path?: string) {
    return Layer.effect(
        Service,
        Effect.gen(function* () {
            const databasePath = yield* Effect.try({
                try: () => {
                    const resolved = resolveDatabasePath(path ?? undefined);

                    if (resolved !== ":memory:") {
                        mkdirSync(dirname(resolved), {
                            recursive: true,
                        });
                    }

                    return resolved;
                },
                catch: toError,
            });

            const client = yield* Effect.acquireRelease(
                Effect.try({
                    try: () => new NativeDatabase(databasePath),
                    catch: toError,
                }),
                (client) =>
                    Effect.sync(() => {
                        client.close();
                    }),
            );

            const db = yield* Effect.try({
                try: () => {
                    client.pragma("foreign_keys = ON");
                    client.pragma("journal_mode = WAL");
                    client.pragma("synchronous = NORMAL");
                    client.pragma("busy_timeout = 5000");

                    const db = drizzle({
                        client,
                        schema,
                    });

                    migrate(db, {
                        migrationsFolder: fileURLToPath(
                            new URL(
                                "../../drizzle/",
                                import.meta.url,
                            ),
                        ),
                    }); 

                    return db;
                },
                catch: toError,
            });

            return {
                db,
                client,
            };
        }),
    );
}

export const defaultLayer = makeLayer();

export const testLayer = makeLayer(":memory:");
