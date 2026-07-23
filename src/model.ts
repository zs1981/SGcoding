import "dotenv/config"
import OpenAI from "openai";

export type ModelMessage = {
    role: "user" | "assistant",
    content: [
        {
            type: "input_text",
            text: string,
        },
    ]
}

export async function askArkModel(
    messages: readonly ModelMessage[],
    modelId: string,
): Promise<string> {
    const apiKey = process.env.ARK_API_KEY;

    if (!apiKey) {
        throw new Error("Lost api_key")
    }

    const client = new OpenAI({
        baseURL: "https://ark.cn-beijing.volces.com/api/v3",
        apiKey: apiKey
    });

    const response = await client.responses.create({
        model: modelId,
        input: messages.map((msg: ModelMessage) => ({
            role: msg.role,
            content:msg.content
        }))
    });

    return response.output_text;
}
