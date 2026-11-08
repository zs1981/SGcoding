import { Context, Effect, Layer, Stream } from "effect";
import { streamText, type ModelMessage } from "ai";
import * as Provider from "./provider.js";
import * as LLMAISDK from "./aisdk.js";
import { toError } from "../util/error.js";
import type { AgentConfig } from "../agent/schema.js";
import type { LLMEvent } from "./schema/llm-event.js";

export interface StreamInput {
    model: string;
    messages: ModelMessage[];
    system?: string;
    agent?: AgentConfig;
    temperature?: number;
    maxRetries?: number;
}

export interface Interface {
    readonly stream: (input: StreamInput) => Stream.Stream<LLMEvent, Error>;
}

export interface Config<Identifier> {
    readonly service: Context.Service<Identifier, Interface>;
}

export function LLMLayer<Identifier>(
    config: Config<Identifier>
) {
    return Layer.effect(
        config.service,
        Effect.gen(function* () {
            const provider = yield* Provider.Service;

            return config.service.of({
                stream: (input) => 
                    Stream.scoped(
                        Stream.unwrap(
                            Effect.gen(function* () {
                                const { providerID, modelID } = yield* provider.parseModel(input.model);

                                const lang = yield* provider.getLang(providerID, modelID);

                                const controller = yield* Effect.acquireRelease(
                                    Effect.sync(() => new AbortController()),

                                    (controller) => 
                                        Effect.sync(() => controller.abort()),
                                );

                                const response = yield* Effect.try({
                                    try: () => {
                                        return streamText({
                                            model: lang,
                                            messages: [...input.messages],
                                            system: input.agent?.prompt ?? input.system,
                                            temperature: input.agent?.temperature ?? input.temperature,
                                            maxRetries: input.maxRetries,
                                            abortSignal: controller.signal,
                                        });
                                    },

                                    catch: toError,
                                })

                                const state = LLMAISDK.apdaterState();

                                return Stream.fromAsyncIterable(
                                    response.stream,
                                    toError,
                                ).pipe(
                                    Stream.mapEffect((event) => 
                                        LLMAISDK.toLLMEvents(state, event),
                                    ),
                                    Stream.flatMap((events) => Stream.fromIterable(events)),
                                );
                            }),
                        ),
                    ),
            });
        }),
    )
}