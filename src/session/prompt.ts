import { Context, Layer, Effect, Config } from "effect";

import { createTools } from "../tools/index.js";
import type { AgentConfig } from "../agent/schema.js";
import * as Provider from "../llm/provider.js";
import * as LLM from "../llm/interface.js";

import * as Session from "./interface.js";
import * as Store from "./store-service.js";
import * as Processor from "./processor.js";

import { MessageV2 } from "./message-v2.js";
import { toModelMessage } from "./model-messages.js";
import {
    SessionArchivedError,
    SessionNotFoundError
} from "./error.js";
import { toError } from "../util/error.js";


export type PromptPart =
    | Pick<MessageV2.TextPart, "type" | "text">
    | Pick<
        MessageV2.FilePart,
        "type" | "mime" | "filename" | "url" | "source"
    >;

export interface PromptInput {
    sessionID: MessageV2.SessionID,
    parts: readonly PromptPart[];

    agent: AgentConfig;
    model?: string;
    system?: string;

    path: {
        cwd: string;
        root: string;
    };

    noReply?: boolean;
    maxSteps?: number;
}

export interface Interface {
    readonly prompt: (
        input: PromptInput,
    ) => Effect.Effect<MessageV2.WithParts, Error>;
}


export interface Config<Identifier> {
    readonly service: Context.Service<Identifier, Interface>;
};

export function PromptLayer<Identifier> (
    config: Config<Identifier>,
) {
    return Layer.effect(
        config.service,
        Effect.gen(function* () {
            const sessions = yield* Session.Service;
            const store = yield* Store.Service;
            const provider = yield* Provider.Service;
            const llm = yield* LLM.Service;

            const running = new Set<MessageV2.SessionID>();

            const run = (
                input: PromptInput,
            ): Effect.Effect<MessageV2.WithParts, Error> =>
                Effect.gen(function* () {
                    const maxSteps = input.maxSteps ?? 16;

                    if (!Number.isInteger(maxSteps) || maxSteps < 1) {
                        return yield* Effect.fail(
                            new Error("maxSteps must be a positive integer"),
                        );
                    }

                    const hasContent = input.parts.some(
                        (part) =>
                            part.type === "file" ||
                            part.text.trim().length > 0,
                    );

                    if (!hasContent) {
                        return yield* Effect.fail(
                            new Error("Prompt content cannot be empty"),
                        );
                    }

                    const session = yield* store.get(input.sessionID);

                    if (!session) {
                        return yield* Effect.fail(
                            new SessionNotFoundError(input.sessionID),
                        );
                    }

                    if (session.timeArchived !== null) {
                        return yield* Effect.fail(
                            new SessionArchivedError(
                                input.sessionID,
                                session.timeArchived,
                            ),
                        );
                    }

                    const modelRef = input.model ?? input.agent.model;

                    if (!modelRef) {
                        return yield* Effect.fail(
                            new Error("No model was selected"),
                        );
                    }

                    const resolved = yield* provider.parseModel(modelRef);

                    const model = {
                        providerID: MessageV2.ProviderID.make(
                            resolved.providerID,
                        ),
                        modelID: MessageV2.ModelID.make(
                            resolved.modelID,
                        ),
                    };  //给参数附带上品牌

                    const user: MessageV2.User = {
                        id: MessageV2.MessageID.ascending(),
                        sessionID: input.sessionID,
                        role: "user",
                        time: {
                            created: Date.now(),
                        },
                        agent: input.agent.name,
                        model,
                        system: input.system,
                    };

                    const userParts: MessageV2.Part[] =
                        input.parts.map((part) => ({
                            ...part,
                            id: MessageV2.PartID.ascending(),
                            sessionID: input.sessionID,
                            messageID: user.id,
                        }));

                    yield* sessions.UpdateMessage(
                        structuredClone(user),
                    );

                    for (const part of userParts) {
                        yield* sessions.UpdatePart(part);
                    }

                    if (input.noReply === true) {
                        return {
                            info: user,
                            parts: userParts,
                        };
                    }

                    const agent: AgentConfig = {
                        ...input.agent,
                        prompt: [
                            input.agent.prompt,
                            input.system,
                        ]
                            .filter(
                                (text): text is string =>
                                    typeof text === "string" &&
                                    text.length > 0,
                            )
                            .join("\n\n"),
                    };

                    const tools = createTools(input.path.root);

                    for (let step = 0; step < maxSteps; step++) {
                        const history = yield* store.context(
                            input.sessionID,
                        );

                        const messages = yield* Effect.try({
                            try: () =>
                                toModelMessage(history, model),
                            catch: toError,
                        });

                        const assistant: MessageV2.Assistant = {
                            id: MessageV2.MessageID.ascending(),
                            sessionID: input.sessionID,
                            parentID: user.id,
                            role: "assistant",

                            modelID: model.modelID,
                            providerID: model.providerID,
                            agent: agent.name,
                            mode: agent.name,

                            path: {
                                cwd: input.path.cwd,
                                root: input.path.root,
                            },

                            time: {
                                created: Date.now(),
                            },

                            cost: 0,
                            tokens: {
                                input: 0,
                                output: 0,
                                reasoning: 0,
                                cache: {
                                    read: 0,
                                    write: 0,
                                },
                            },
                        };

                        const outcome = yield* Effect.gen(
                            function* () {
                                yield* sessions.UpdateMessage(
                                    structuredClone(assistant),
                                );

                                return yield* Processor.process(
                                    llm,
                                    sessions,
                                    assistant,
                                    {
                                        model: modelRef,
                                        messages,
                                        agent,
                                        tools,
                                    },
                                );
                            },
                        ).pipe(
                            Effect.onInterrupt(() =>
                                Effect.gen(function* () {
                                    if (
                                        assistant.time.completed !== undefined
                                    ) {
                                        return;
                                    }

                                    assistant.error ??=
                                        new MessageV2.AbortedError({
                                            message:
                                                "Response generation was interrupted",
                                        }).toObject();

                                    assistant.finish = "error";
                                    assistant.time.completed = Date.now();

                                    yield* sessions.UpdateMessage(
                                        structuredClone(assistant),
                                    );
                                }),
                            ),
                        );

                        const updated = yield* store.context(
                            input.sessionID,
                        );

                        const current = updated.find(
                            (message) =>
                                message.info.id === assistant.id,
                        );

                        if (
                            !current ||
                            current.info.role !== "assistant"
                        ) {
                            return yield* Effect.fail(
                                new Error(
                                    "The generated assistant message was not found",
                                ),
                            );
                        }

                        if (outcome === "compact") {
                            return yield* Effect.fail(
                                new Error(
                                    "Context compaction is required but is not connected yet",
                                ),
                            );
                        }

                        if (
                            outcome === "stop" ||
                            current.info.error !== undefined
                        ) {
                            return current;
                        }

                        const toolParts = current.parts.filter(
                            (part): part is MessageV2.ToolPart =>
                                part.type === "tool",
                        );

                        const hasIncompleteTool = toolParts.some(
                            (part) =>
                                part.state.status === "pending" ||
                                part.state.status === "running" ||
                                (
                                    part.state.status === "error" &&
                                    (
                                        part.state.metadata?.incomplete === true ||
                                        part.state.metadata?.interrupted === true
                                    )
                                ),
                        );

                        if (hasIncompleteTool) {
                            return yield* Effect.fail(
                                new Error(
                                    "The response contains an unfinished tool call",
                                ),
                            );
                        }

                        const hasLocalToolResult = toolParts.some(
                            (part) =>
                                part.metadata?.providerExecuted !== true &&
                                (
                                    part.state.status === "completed" ||
                                    part.state.status === "error"
                                ),
                        );

                        if (hasLocalToolResult) {
                            continue;
                        }

                        const finish = current.info.finish;

                        if (
                            finish !== undefined &&
                            finish !== "tool-calls" &&
                            finish !== "unknown"
                        ) {
                            return current;
                        }

                        if (
                            finish === "tool-calls" &&
                            toolParts.length > 0
                        ) {
                            continue;
                        }

                        return yield* Effect.fail(
                            new Error(
                                "The model response has no conclusive finish state",
                            ),
                        );
                    }

                    return yield* Effect.fail(
                        new Error(
                            `Prompt exceeded the maximum of ${maxSteps} model rounds`,
                        ),
                    );
                });

            return config.service.of({
                prompt: (input) =>
                    Effect.acquireUseRelease(
                        Effect.try({
                            try: () => {
                                if (running.has(input.sessionID)) {
                                    throw new Error(
                                        `Session ${input.sessionID} is already running`,
                                    );
                                }

                                running.add(input.sessionID);
                                return input.sessionID;
                            },
                            catch: toError,
                        }),

                        () => run(input),

                        (sessionID) =>
                            Effect.sync(() => {
                                running.delete(sessionID);
                            }),
                    ),
            });
        }),
    );
}
