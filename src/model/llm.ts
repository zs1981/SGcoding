import { Context, Effect, Layer, Stream } from "effect";
import { streamText, type ModelMessage } from "ai";
import type { AgentConfig } from "../agent/agent.js";
import * as Provider from "./provider.js";
import * as LLMAISDK from "./llm-ai-sdk.js";
import type { LLMEvent } from "./llm-event.js";

export interface StreamInput {
    model: string;
    message: ModelMessage[];
    system?: string;
    agent?: AgentConfig;
    temperature?: number;
    maxRetries?: number;
}

export interface Interface {
    readonly stream: (input: StreamInput) => Stream.Stream<LLMEvent, Error>;
}

export class Service extends Context.Service<
    Service,
    Interface
>()("sgcoding/LLM") {}


