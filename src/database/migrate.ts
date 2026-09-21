import { fileURLToPath } from "node:url"
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { connectDatabase } from "./database.js";
import { resolveDatabasePath } from "./path.js";

const databasePath = resolveDatabasePath();

const migrationsFolder = fileURLToPath(
    new URL("../../drizzle/", import.meta.url)
)

const {db, client} = connectDatabase(databasePath);

try {
    migrate(db, { migrationsFolder });
} finally {
    client.close();
}
