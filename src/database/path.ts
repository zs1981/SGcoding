import "dotenv/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function resolveDatabasePath(databasePath?: string): string {
    const configuredPath = databasePath ?? process.env.SGCODING_DATABASE_PATH;

    if (configuredPath === ":memory:") {
        return configuredPath;
    }

    if (configuredPath) {
        return resolve(configuredPath);
    }

    return fileURLToPath(
        new URL("../../data/sgcoding.db", import.meta.url)
    );
}