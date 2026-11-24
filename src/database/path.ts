import { resolve } from "node:path";
import { loadUserEnvironment, userDirectory } from "../config.js";

export function resolveDatabasePath(databasePath?: string): string {
    loadUserEnvironment();
    const configuredPath = databasePath ?? process.env.SGCODING_DATABASE_PATH;

    if (configuredPath === ":memory:") {
        return configuredPath;
    }

    if (configuredPath) {
        return resolve(configuredPath);
    }

    return resolve(userDirectory(), "sgcoding.db");
}
