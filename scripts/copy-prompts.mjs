import { cpSync, mkdirSync } from "node:fs";

const source = new URL(
    "../src/agent/prompt/",
    import.meta.url,
);

const target = new URL(
    "../dist/agent/prompt/",
    import.meta.url,
);

mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });