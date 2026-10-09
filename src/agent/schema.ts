import { Schema, SchemaGetter } from "effect";

export * as schema from "./schema.js";

export const AgentConfig = Schema.Struct({
    name: Schema.String,
    native: Schema.Boolean,
    hidden: Schema.Boolean,
    prompt: Schema.String,
    temperature: Schema.Number,
    model: Schema.optional(Schema.String),
});

export type AgentConfig = Schema.Schema.Type<typeof AgentConfig>;