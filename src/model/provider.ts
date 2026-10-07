import "dotenv/config";
import { createOpenAI } from "@ai-sdk/openai";
import { Context, Effect, Layer } from "effect";
import { toError } from "../util/error.js";

export type ProviderConfig = {
    name: string;
    env: string[];
    smallModel?: string;
    options: {
        baseURL: string;
    };
    models: Record<string, {            
        name: string;                   
    }>;
};

export type Model = {
    modelID: string;
    providerID: string;
};

export type LanguageModel = ReturnType<
    ReturnType<typeof createOpenAI>["responses"]
>;

const providers: Record<string, ProviderConfig> = {
    deepseek: {
        name: "DeepSeek",
        env: ["DEEPSEEK_API_KEY"],
        smallModel: "deepseek-flash",
        options: {
            baseURL: "https://api.deepseek.com",
        },
        models: {                        
            "deepseek-flash": {
                name: "DeepSeek Flash"  
            },
            "deepseek-v4-pro": {
                name: "DeepSeek V4 Pro"
            },
        },
    },

    ark: {
        name: "Volcano Ark",
        env: ["ARK_API_KEY"],
        smallModel: "doubao-seed-2-0-mini-260428",
        options: {
            baseURL: "https://ark.cn-beijing.volces.com/api/v3"
        },
        models: {
            "doubao-seed-2-0-mini-260428": {
                name: "Doubao Seed 2.0 Mini",
            },
        },
    },

};

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

export function parseModel(value: string) {
    const [provider, ...rest] = value.split("/");

    const providerID = provider?.trim();
    const modelID = rest.join("/").trim();

    if (!providerID || !modelID) {
        throw new Error(
            "模型格式应为 平台ID/模型ID，例如 deepseek/deepseek-flash",
        );
    }

    return { providerID, modelID };
}

export interface Interface {
    readonly getProvider: (providerID: string) => Effect.Effect<ProviderConfig, Error>;

    readonly getModel: (providerID: string, modelID: string) => Effect.Effect<Model, Error>;   // 感觉可以优化一下，一个Model定义的很丑

    readonly getSmallModel: (providerID: string) => Effect.Effect<Model | undefined, Error>;

    readonly getLang: (model: Model) => Effect.Effect<LanguageModel, Error>;
}

export class Service extends Context.Service<
    Service,
    Interface
>()("sgcoding/Provider") {}


export const layer = Layer.effect(
    Service,
    Effect.sync(() => {
        const clients = new Map<string, ReturnType<typeof createOpenAI>>();

        const languages = new Map<string, LanguageModel>();

        function lookupProvider(providerID: string): ProviderConfig {
            if (!Object.hasOwn(providers, providerID)) {
                throw new Error("");
            };

            return providers[providerID]
        }

        function lookupModel(
            providerID: string,
            modelID: string,
        ) {
            const provider = lookupProvider(providerID);

            if (!Object.hasOwn(provider.models, modelID)) {
                throw new Error();
            }

            return {
                modelID: modelID,
                providerID: providerID,
            }
        }

        return Service.of ({
            getProvider: (providerID: string) => Effect.try({
                try: () =>  lookupProvider(providerID),
                catch: toError,
            }),

            getModel: (providerID: string, modelID: string) => Effect.try({
                try: () => lookupModel(providerID, modelID),
                catch: toError,
            }),

            getSmallModel: (providerID: string) => Effect.try({
                try: () => {
                    const provider = lookupProvider(providerID);

                    if (!provider.smallModel) {
                        return undefined;
                    } else {
                        return {
                            modelID: provider.smallModel,
                            providerID: providerID,
                        };
                    }
                },
                catch: toError,
            }),

            getLang: (model: Model) => Effect.try({
                try: () => {
                    const key = JSON.stringify([
                        model.modelID,
                        model.providerID,
                    ]);

                    const cached = languages.get(key);

                    if (cached !== undefined) return cached;

                    let client = clients.get(model.providerID);

                    if (client === undefined) {
                        const provider = lookupProvider(model.providerID);

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
                            fetch: model.providerID === "ark" 
                                ? arkFetch
                                : undefined,
                        });

                        clients.set(model.providerID, client);
                    }

                    const language = client.responses(model.modelID);
                    
                    languages.set(key, language);

                    return language;        
                },
                catch: toError,
            }),
        });
    }),
);

export const defaultLayer = layer;

