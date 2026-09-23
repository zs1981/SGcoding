import { readFileSync } from "node:fs";

export const TITLE_PROMPT = readFileSync(
    new URL("./prompt/title.txt", import.meta.url), "utf-8"
);

export interface AgentConfig {
    name: string;
    native: boolean;
    hidden: boolean;
    prompt: string;
    temperature: number;
    model?: string;
}

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