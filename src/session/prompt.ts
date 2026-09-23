import type { ModelMessage } from "ai";
import * as Agent from "../agent/agent.js";
import * as Provider from "../model/provider.js";
import type { Runtime } from "../runtime.js";
import { isDefaultTitle } from "./service.js"; 
import type {
    SessionItem,
    SessionMessage,
} from "./store.js"

export function toModelMessages(
    modelMessages: readonly SessionMessage[],
): ModelMessage[] {
    return modelMessages
        .filter((message) => message.status !== "error")
        .map((message): ModelMessage => {
            if (message.role !== "user" && 
                message.role !== "assistant" && 
                message.role !== "system") {
                    throw new Error(`Unkown message role: ${message.role}`);
                }
            
            return {
                role: message.role,
                content: message.content
            };
        });
}


export async function ensureTitle(
    runtime: Runtime,
    session: SessionItem,
    history: readonly SessionMessage[],
    currentModel: string,
): Promise<void> {
    if (!session || session.timeArchived !== null) return;

    if (!isDefaultTitle(session.title)) return;

    const userMessages = history.filter((message) => message.role === "user");

    if ( userMessages.length !== 1) return;

    const firstUserIndex = history.findIndex((message) => message.role === "user")

    const context = history.slice(0, firstUserIndex + 1);

    const agent = Agent.get("title")

    if (agent === undefined) {
        return;
    }

    let titleModel: string;

    if (agent.model !== undefined) {
        titleModel = agent.model;
    } else {
        const { providerID } = Provider.parseModel(currentModel);
        const smallModel = Provider.getSmallModel(providerID);

        if (smallModel !== undefined) {
            titleModel = `${smallModel.providerID}/${smallModel.id}`;
        } else {
            titleModel = currentModel;
        }
    }

    const messages: ModelMessage[] = [{
        role: "user",
        content: "Generate a title for this conversation:\n", 
    },
    ...toModelMessages(context),
    ];

    const text = await runtime.askModel(
        messages,
        titleModel,
        {
            agent, 
            maxRetries: 2,
        }
    );

    const cleand = text
        .replace(/<think>[\s\S]*?<\/think>\s*/g, "")
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line.length > 0);
    
    if (cleand === undefined) return;

    let title = cleand;

    if (title.length > 100) {
        title = title.slice(0, 97) + "...";
    }
    
    runtime.sessions.setTitle(session.id, title);
}