import "dotenv/config";
import { createOpenAI } from "@ai-sdk/openai";
import { Context, Effect, Layer } from "effect";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { toError } from "../util/error.js";
import { LLMConfig } from "./schema.js"

export type LanguageModel = ReturnType<
    ReturnType<typeof createOpenAI>["responses"]
>;

const arkFetch: typeof globalThis.fetch = async (requestInfo, init) => {
    const url =
        typeof requestInfo === "string"
            ? requestInfo
            : requestInfo instanceof URL
                ? requestInfo.href
                : requestInfo.url;

    if (
        !new URL(url).pathname.endsWith("/responses") || 
        typeof init?.body !== "string"
    ) {
        return globalThis.fetch(requestInfo, init);
    }

    const body = JSON.parse(init.body);
    
    if (!Array.isArray(body.input)) {
        return globalThis.fetch(requestInfo, init);
    }

    body.input = body.input.map((item: unknown) => {
        if (
            typeof item !== "object" ||
            item === null ||
            "type" in item ||
            !("role" in item)
        ) {
            return item;
        }

        if (
            item.role !== "user" &&
            item.role !== "assistant" &&
            item.role !== "system" 
        ) {
            return item;
        }

        return {
            ...item,
            type: "message"
        };
    });

    return globalThis.fetch(requestInfo, {
        ...init,
        body: JSON.stringify(body),
    }); 
};

export interface Interface {
    readonly parseModel: (value: string) => Effect.Effect<
        { providerID: string, modelID: string},
        Error
    >;

    readonly getLang: (providerID: string, modelID: string) => Effect.Effect<LanguageModel, Error>;
}

export class Service extends Context.Service<
    Service,
    Interface
>()("sgcoding/Provider") {}

export function makeLayer(path: string) {
    return Layer.effect(
        Service,
        Effect.gen(function* ()  {
            const clients = new Map<string, ReturnType<typeof createOpenAI>>();

            const languages = new Map<string, LanguageModel>();

            const providers = yield* Effect.try({
                try: () => {
                    const fileURL = new URL(path, import.meta.url);
                    const content = readFileSync(fileURL, "utf-8");
                    const providers: LLMConfig.ProvidersConfig = parse(content);
                    return providers;
                },
                
                catch: toError,
            });

            return Service.of ({
                parseModel: (value: string) => Effect.try({
                    try: () => {
                        const [provider, ...rest] = value.split("/");

                        const providerID = provider?.trim();
                        const modelID = rest.join("/").trim();

                        if (!providerID || !modelID) {
                            throw new Error("模型格式应为 平台ID/模型ID，例如 deepseek/deepseek-flash")
                        }

                        if (!Object.hasOwn(providers, providerID)){
                            throw new Error();
                        }

                        if (!Object.hasOwn(providers[providerID].models, modelID)){
                            throw new Error();
                        }

                        return { providerID, modelID };
                    },
                    catch: toError,
                }),

                getLang: (providerID: string, modelID: string) => Effect.try({
                    try: () => {
                        const key = JSON.stringify([providerID, modelID]);

                        const cached = languages.get(key);

                        if (cached !== undefined) return cached;

                        let client = clients.get(providerID);

                        if (client === undefined) {
                            const provider = providers[providerID];

                            const apiKey = provider.env
                                .map((name) => process.env[name])
                                .find(
                                    (value) => 
                                        value !== undefined &&
                                        value.trim().length > 0,
                                );
                            
                            if ( apiKey === undefined) {
                                throw new Error();
                            }

                            client = createOpenAI({
                                baseURL: provider.options.baseURL,
                                apiKey,
                                fetch: providerID === "ark" 
                                    ? arkFetch
                                    : undefined,
                            });

                            clients.set(providerID, client);
                        }

                        const language = client.responses(modelID);
                        
                        languages.set(key, language);

                        return language;        
                    },
                    catch: toError,
                }),
            });
        }),
    );
}
export const defaultLayer = makeLayer("../../default-provider.yaml");

