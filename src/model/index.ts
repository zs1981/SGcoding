import { 
    streamText,
    type ModelMessage
 } from "ai";
import * as Provider from "./provider.js";


export async function askModel(
    messages: readonly ModelMessage[],
    model: string,
): Promise<string> {
    const {providerID, modelID} = Provider.parseModel(model);

    const info = Provider.getModel(providerID, modelID);

    const lang = Provider.getLang(info);

    const result = streamText({
        model: lang,
        messages:[...messages],
        maxRetries: 0,
        });

    let reply = "";
    
    for await (const part of result.stream) {
        if (part.type === "error") {
            throw part.error;
        }

        if (part.type === "text-delta") {
            reply += part.text;
        }
    }

    return reply;
};
