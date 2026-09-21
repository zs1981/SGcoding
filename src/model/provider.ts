import "dotenv/config";
import { createOpenAI } from "@ai-sdk/openai";

type ProviderConfig = {
    name: string;
    env: string[];
    options: {
        baseURL: string;
    };
    models: Record<string, {            
        name: string;                   
    }>;
};

export type Model = {
    id: string;
    providerID: string;
    name: string;
};

const providers: Record<string, ProviderConfig> = {
    deepseek: {
        name: "DeepSeek",
        env: ["DEEPSEEK_API_KEY"],
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

const clients = new Map<
    string,
    ReturnType<typeof createOpenAI>
>();

const arkFetch: typeof globalThis.fetch = async (input, init) => {
    const url =
        typeof input === "string"
            ? input
            : input instanceof URL
                ? input.href
                : input.url;

    if (
        !new URL(url).pathname.endsWith("/responses") || 
        typeof init?.body !== "string"
    ) {
        return globalThis.fetch(input, init);
    }

    const body = JSON.parse(init.body);
    
    if (!Array.isArray(body.input)) {
        return globalThis.fetch(input, init);
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

    return globalThis.fetch(input, {
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

export function getProvider(provider: string): ProviderConfig {
    if (!Object.hasOwn(providers, provider)) {
        throw new Error(`平台不存在：${provider}`)
    }

    return providers[provider];
}

export function getModel(
    providerID: string,
    modelID: string,
): Model {
    const provider = getProvider(providerID);

    if (!Object.hasOwn(provider.models, modelID)) {
            throw new Error(`模型未配置：${providerID}/${modelID}`);
    }

    const model = provider.models[modelID];

    return {
        id: modelID,
        providerID,
        name: model.name,
    };
}

export function getLang(model: Model) {
    let client = clients.get(model.providerID);

    if (!client) {
        const provider = getProvider(model.providerID);

        const apiKey = provider.env
            .map((name) => process.env[name])
            .find((value) => Boolean(value));

        if (!apiKey) {
            throw new Error(`请配置环境变量：${provider.env.join(" 或 ")}`);
        }
    

        client = createOpenAI({
            baseURL: provider.options.baseURL,
            apiKey,
            fetch: model.providerID === "ark" ? arkFetch : undefined,
        });

        clients.set(model.providerID, client);
    }

    return client.responses(model.id);
}

