import { readFileSync } from "node:fs";
import { type AgentConfig } from "./schema.js";

export const TITLE_PROMPT = readFileSync(
    new URL("./prompt/title.txt", import.meta.url), "utf-8"
);

const agents: Record<string, AgentConfig> = {
    title: {
        name: "title",
        native: true,
        hidden: true,
        prompt: TITLE_PROMPT,
        temperature: 0.5,
    },
};

export function get(
    name: string,
): AgentConfig | undefined {
    if (!Object.hasOwn(agents, name)) {
        return undefined;
    }

    return agents[name];
}