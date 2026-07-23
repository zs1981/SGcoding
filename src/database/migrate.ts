import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url"
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { connectDatabase } from "./database.js";

const databasePath = fileURLToPath(
    new URL("../../data/sgcoding.db", import.meta.url)
);

const migrationsFolder = fileURLToPath(
    new URL("../../drizzle/", import.meta.url)
)

mkdirSync(dirname(databasePath), {
    recursive: true
});

const {db, client} = connectDatabase(databasePath);

try {
    migrate(db, { migrationsFolder });
} finally {
    client.close();
}
