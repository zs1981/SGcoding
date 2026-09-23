import type { CliOptions } from "../cliArgs.js";
import {
    ensureTitle,
    toModelMessages
} from "../session/prompt.js"
import { SessionItem, SessionMessage } from "../session/store.js";
import type { Runtime } from "../runtime.js";
import { 
    SessionNotFoundError, 
    SessionArchivedError
} from "../session/error.js";
import { run } from "node:test";

type ChatData = Extract<
    CliOptions,
    { command: "run"}
>["data"];


export async function runCommand(
    runtime: Runtime,
    data: ChatData
): Promise<void> {
    const input = data.input;

    if (!input) {
        throw new Error("message cannot be empty");
    }

    let sessionID: string;
    let session: SessionItem | undefined;

    if (data.sessionId === undefined) {
        sessionID = runtime.sessions.createSession(data.title);
        session = runtime.store.get(sessionID);
    } else {
        session = runtime.store.get(data.sessionId);

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

        sessionID = session.id;
    }

    runtime.sessions.appendMessage(
        sessionID,
        {
            role: "user",
            content: input,
            status: "success",
        },
    )

    const history = runtime.store.context(sessionID);

    const modelMessages = toModelMessages(history)

    if (session) {          // 总有一天我要删除你，不符合逻辑的冗余产物
        try {
            await ensureTitle(runtime, session, history, data.modelId)
        } catch {}
    };

    let reply: string;

    try {
        reply = await runtime.askModel(modelMessages, data.modelId);
    } catch (error: unknown) {
        const errorMessage = 
            error instanceof Error
                ? error.message
                : String(error);

    runtime.sessions.appendMessage(
        sessionID,
        {
            role: "assistant",
            content: "",
            status: "error",
            error: errorMessage,
        },);

        throw error;
    };

    runtime.sessions.appendMessage(
        sessionID,
        {
            role: "assistant",
            content: reply,
        },
    );

    console.error(`Session: ${sessionID}`);
    console.log(reply);
}
