import type { CliOptions } from "../cliArgs.js";
import { type ModelMessage } from "ai";
import { SessionMessage } from "../session/store.js";
import type { Runtime } from "../runtime.js";
import { 
    SessionNotFoundError, 
    SessionArchivedError
} from "../session/error.js";

type ChatData = Extract<
    CliOptions,
    { command: "run"}
>["data"];

function toModelMessage(
    message: SessionMessage,
): ModelMessage {  
    if (
        message.role !== "user" &&
        message.role !== "assistant" &&
        message.role !== "system"
    ) {
        throw new Error(
            `Unknown message role: ${message.role}`,
        );
    }
    
    return {
        role: message.role,
        content: message.content,
    };
}

export async function runCommand(
    runtime: Runtime,
    data: ChatData
): Promise<void> {
    const input = data.input;

    if (!input) {
        throw new Error("message cannot be empty");
    }

    let sessionId: string;

    if (data.sessionId === undefined) {
        sessionId = runtime.sessions.createSession();
    } else {
        const session = runtime.store.get(data.sessionId);

        if (!session) {
            throw new SessionNotFoundError(
                data.sessionId,
            );
        }

        if (session.timeArchived !== null) {
            throw new SessionArchivedError(
                session.id, session.timeArchived
            );
        }

        sessionId = session.id;
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
        reply = await runtime.askModel(modelMessages, data.modelId);
    } catch (error: unknown) {
        const errorMessage = 
            error instanceof Error
                ? error.message
                : String(error);

    runtime.sessions.appendMessage(
        sessionId,
        {
            role: "assistant",
            content: "",
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

    console.error(`Session: ${sessionId}`);
    console.log(reply);
}
