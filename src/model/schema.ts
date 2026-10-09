import { Schema, SchemaAST } from "effect";
import { type ModelMessage } from "ai";
import { type AgentConfig } from "../agent/schema.js";


export * as LLMConfig from "./schema.js"

export const ProvidersConfig = Schema.Record(
    Schema.String,
    Schema.Struct({
        name: Schema.String,
        env: Schema.Array(Schema.String),
        options: Schema.Struct({         
            baseURL: Schema.String,
        }),
        models: Schema.Record(             
            Schema.String,
            Schema.Struct({
                name: Schema.String,
            }),
        ),
    }),
);

export type ProvidersConfig = Schema.Schema.Type<typeof ProvidersConfig>;

export type StreamInput = {
    model: string;
    messages: ModelMessage[];
    system?: string;
    agent?: AgentConfig;
    temperature?: number;
    maxRetries?: number;
};