import type { CliOptions } from "../cliArgs.js";
import {
    type ModelMessage,
    askArkModel
} from "../model.js";
import { SessionMessage } from "../session/store.js";
import type { Runtime } from "../runtime.js";

type ChatData = Extract<
    CliOptions,
    { command: "run"}
>["data"];

function toModelMessage(
    message: SessionMessage,
): ModelMessage {  
    if (
        message.role !== "user" &&
        message.role !== "assistant"
    ) {
        throw new Error(
            `Unknown message role: ${message.role}`,
        );
    }
    return {
        role: message.role,
        content: [
            {
                type: "input_text",
                text: message.content,
            },
        ],
    };
}

export async function runCommand(
    runtime: Runtime,
    data: ChatData
): Promise<void> {
    const input = data.input;
    let sessionId = data.sessionId ?? runtime.sessions.createSession();

    if (!input) {
        throw new Error("message cannot be empty");
    }

    runtime.sessions.appendMessage(
        sessionId,
        {
            role: "user",
            content: input,
            status: "success",
        },
    )

    const storeMessages = runtime.store.context(sessionId);

    const modelMessages = storeMessages
        .filter((message: SessionMessage) => {
            return message.status !== "error"
        })
        .map(toModelMessage)
    
    let reply: string;

    try {
        reply = await askArkModel(modelMessages, data.modelId);
    } catch (error: unknown) {
        const errorMessage = 
            error instanceof Error
                ? error.message
                : String(error);

    runtime.sessions.appendMessage(
        sessionId,
        {
            role: "assistant",
            content: "模型请求失败",
            status: "error",
            error: errorMessage,
        },);

        throw error;
    };

    runtime.sessions.appendMessage(
        sessionId,
        {
            role: "assistant",
            content: reply,
        },
    );
}
