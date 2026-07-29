import { randomUUID } from "node:crypto";
import type { EventService } from "../event/service.js";

export interface MessageInput {
    role: "user" | "assistant";
    content: string;
    status?: "success" | "error";
    error?: string | null;
}

export class SessionService {
    constructor(private readonly events: EventService) {}

    createSession(): string {
        const sessionId = `ses_${randomUUID()}`;

        this.events.publish({
            aggregateId: sessionId,
            type: "session.created",
            data: {
                timeCreate: Date.now(),
            },
        });

        return sessionId;
    }

    appendMessage(
        sessionId: string,
        input: MessageInput
    ): string {
        const messageId = `msg_${randomUUID()}`;

        this.events.publish({
            aggregateId: sessionId,
            type: 'message.append',
            data: {
                messageId: messageId,
                role: input.role,
                content: input.content,
                status: input.status ?? "success",
                error: input.error ?? null,
                timeCreate: Date.now(),
            },
        });

        return messageId;
    }

    stepFailed(
        sessionId: string,
        messageId: string,
        error: string,
    ): void {
        this.events.publish({
            aggregateId: sessionId,
            type: "step.failed",
            data: {
                messageId: messageId,
                error: error,
            },
        });
    }

    archiveSession(sessionId: string): void {
        this.events.publish({
            aggregateId: sessionId,
            type: "session.archived",
            data: {
                timeArchived: Date.now(),
            },
        });
    }

    unarchiveSession(sessionId: string): void {
        this.events.publish({
            aggregateId: sessionId,
            type: "session.unarchived",
            data:{},
        });
    }

    deleteSession(sessionId: string): void {
        this.events.publish({
            aggregateId: sessionId,
            type: 'session.deleted',
            data: {},
        });
    }
}