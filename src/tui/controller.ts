import { Cause, Deferred, Effect, Exit, Stream } from "effect";

import { resolve } from "node:path";

import * as Event from "../event/interface.js";
import * as Session from "../session/interface.js";
import * as Provider from "../llm/provider.js";

import type { Interface as SessionStore } from "../session/store.js";

import type { AgentConfig } from "../agent/schema.js";
import type { MessageV2 } from "../session/message-v2.js";

import { toError } from "../util/error.js";
import {
    createRuntime
} from "../runtime.js";

import {
    applyEvent,
    type TuiState
} from "./state.js";

export type ControllerOptions = {
    root: string;
    model: string;
    agent: AgentConfig;
    providerConfig: string;
    databasePath?: string;
    sessionID?: MessageV2.SessionID;
};

function readSession(store: SessionStore, sessionID: MessageV2.SessionID) {
    return Effect.gen(function* () {
        const session = yield* store.get(sessionID);
        if (!session) {
            return yield* Effect.fail(new Error("会话不存在"));
        }
        if (session.timeArchived !== null) {
            return yield* Effect.fail(new Error("会话已归档"));
        }

        const messages = yield* store.context(sessionID);
        return { sessionID, sessionTitle: session.title, messages };
    });
}

export async function createController(
    options: ControllerOptions,
) {
    const root = resolve(options.root);

    const runtime = createRuntime({
        providerConfig: options.providerConfig,
        databasePath: options.databasePath,
    });

    const watchAbort = new AbortController();

    let watchTask: Promise<void> | undefined;

    try {
        const services = await runtime.runPromise(
            Effect.gen(function* () {
                const sessions = yield* Session.SessionService;
                const store = yield* Session.StoreService;
                const events = yield* Event.Service;
                const prompt = yield* Session.PromptService;
                const provider = yield* Provider.Service;

                yield* provider.parseModel(options.model);

                const sessionID = options.sessionID ?? (yield* sessions.CreateSession());

                const initialSession = yield* readSession(store, sessionID);
                return { events, prompt, store, provider, initialSession };
            }),
        );

        let state: TuiState = {
            project: root,
            ...services.initialSession,
            model: options.model,
            busy: false,
            closing: false,
        };

        const listeners = new Set<() => void>();

        let currentAbort: AbortController | undefined;
        let currentTask: Promise<void> | undefined;
        let closeTask: Promise<void> | undefined;

        let watchAvailable = true;
        let sessionAvailable = true;

        const update = (next: TuiState) => {
            if (next === state) {
                return;
            }

            state = next;

            for (const listener of listeners) {
                listener();
            }
        };

        const patch = (value: Partial<TuiState>) => {
            update({
                ...state,
                ...value,
            });
        };

        const ready = Deferred.makeUnsafe<void, Error>();

        const watch = Effect.scoped(
            Effect.gen(function* () {
                const pull = yield* Stream.toPull(
                    services.events.all(),
                );

                yield* Deferred.succeed(ready, undefined);

                yield* Stream.runForEach(
                    Stream.fromPull(Effect.succeed(pull)),

                    (event) => 
                        Effect.sync(() => {
                            if (
                                event.aggregateID !== state.sessionID
                            ) {
                                return;
                            }

                            if (
                                event.type === "session.delete" ||
                                event.type === "session.archive"
                            ) {
                                sessionAvailable = false;
                                currentAbort?.abort();

                                patch({
                                    error: event.type === "session.delete"
                                        ? "当前会话已删除，输入 /sessions 选择其他会话"
                                        : "当前会话已归档，输入 /sessions 选择其他会话",
                                });

                                return;
                            }

                            update(applyEvent(state, event));
                        }),
                );
            }),
        ).pipe(
            Effect.onExit((exit) => 
                Deferred.fail(
                    ready,
                    new Error(
                        Exit.isFailure(exit)
                        ? Cause.pretty(exit.cause)
                        : "事件订阅已结束"
                    ),
                ),
            ),
        );

        watchTask = runtime.runPromiseExit(
            watch,
            { signal: watchAbort.signal },
        ).then((exit) => {
            if (state.closing) {
                return;
            }

            watchAvailable = false;
            currentAbort?.abort();

            patch({
                error: Exit.isFailure(exit)
                    ? `事件订阅失败：${Cause.pretty(exit.cause)}`
                    : "事件订阅意外结束",
            });
        });

        await runtime.runPromise(Deferred.await(ready));

        if (!watchAvailable) {
            throw new Error(state.error ?? "事件订阅不可用");
        }

        const canSelect = () => !state.busy && !state.closing && watchAvailable;

        const listSessions = () => {
            if (!canSelect()) {
                return undefined;
            }

            const exit = runtime.runSyncExit(services.store.list(50, false));
            if (Exit.isFailure(exit)) {
                patch({ error: Cause.pretty(exit.cause) });
                return undefined;
            }
            return exit.value;
        };

        const switchSession = (sessionID: MessageV2.SessionID): boolean => {
            if (!canSelect()) {
                return false;
            }

            const exit = runtime.runSyncExit(readSession(services.store, sessionID));
            if (Exit.isFailure(exit)) {
                patch({ error: Cause.pretty(exit.cause) });
                return false;
            }

            sessionAvailable = true;
            patch({ ...exit.value, error: undefined });
            return true;
        };

        const listModels = () => {
            if (!canSelect()) {
                return undefined;
            }

            const exit = runtime.runSyncExit(services.provider.listModels());
            if (Exit.isFailure(exit)) {
                patch({ error: Cause.pretty(exit.cause) });
                return undefined;
            }
            return exit.value;
        };

        const switchModel = (value: string): boolean => {
            if (!canSelect()) {
                return false;
            }

            const exit = runtime.runSyncExit(services.provider.parseModel(value));
            if (Exit.isFailure(exit)) {
                patch({ error: Cause.pretty(exit.cause) });
                return false;
            }

            const { providerID, modelID } = exit.value;
            patch({ model: `${providerID}/${modelID}`, error: undefined });
            return true;
        };

        const send = (text: string): boolean => {
            if (!canSelect() || !sessionAvailable) {
                return false;
            }

            const sessionID = state.sessionID;
            const model = state.model;
            const abort = new AbortController();
            currentAbort = abort;

            patch({
                busy: true,
                error: undefined,
            });

            currentTask = (async () => {
                try {
                    const exit = await runtime.runPromiseExit(
                        services.prompt.prompt({
                            sessionID,

                            parts: [
                                {
                                    type: "text",
                                    text,
                                },
                            ],

                            agent: options.agent,
                            model,

                            path: {
                                cwd: root,
                                root,
                            },
                        }),

                        {
                            signal: abort.signal
                        },
                    );

                    if (
                        Exit.isFailure(exit) &&
                        !Cause.hasInterrupts(exit.cause) &&
                        watchAvailable && sessionAvailable
                    ) {
                        patch({
                            error: Cause.pretty(exit.cause)
                        });
                    }
                } catch(error) {
                    if (watchAvailable && sessionAvailable) {
                        patch({
                            error: toError(error).message,
                        });
                    }
                } finally {
                    currentAbort = undefined;

                    patch({
                        busy: false,
                    });
                }
            })();

            return true;
        };

        const cancel = () => {
            currentAbort?.abort();
        };
        
        const close = (): Promise<void> => {
            if (closeTask) {
                return closeTask;
            }

            patch({
                closing: true,
            });

            closeTask = (async () => {
                try {
                    currentAbort?.abort();
                    
                    await currentTask;
                } finally {
                    watchAbort.abort();

                    try {
                        await watchTask;
                    } finally {
                        try {
                            await runtime.dispose();
                        } finally {
                            listeners.clear();
                        }
                    }
                }
            })();

            return closeTask;
        };

        return {
            get sessionID() {
                return state.sessionID;
            },

            getSnapshot: (): TuiState => state,

            subscribe: (listener: () => void) => {
                listeners.add(listener);

                return () => listeners.delete(listener);
            },

            listSessions,
            switchSession,
            listModels,
            switchModel,
            send,
            cancel,
            close,
        };
    } catch(error) {
        watchAbort.abort();

        try {
            await watchTask;
        } finally {
            await runtime.dispose();
        }

        throw error;
    }
}

export type TuiController = Awaited<ReturnType<typeof createController>>;
