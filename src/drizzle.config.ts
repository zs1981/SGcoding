import { defineConfig } from "drizzle-kit";

export default defineConfig({
    schema: "./src/database/schema.js",
    out: "./drizzle",
    dialect: "sqlite",
    dbCredentials: {
        url: "./data/sgcoding.db"
    }

});

