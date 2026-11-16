import { tool, type ModelMessage, type Tool } from "ai";
import { MessageV2 } from "./message-v2.js";
import { date } from "effect/Config";

type UserMessage = Extract<
    ModelMessage, 
    { role: "user"}
>;
type AssistantMessage = Extract<
    ModelMessage,
    {role: "assistant"}
>;
type ToolMessage = Extract<
    ModelMessage,
    {role: "tool"}
>;

type UserContent = Exclude<
    UserMessage["content"],
    string
>;
type AssistantContent = Exclude<
    AssistantMessage["content"],
    string
>;

type ToolResult = Extract<
    ToolMessage["content"][number],
    { type: "tool-result"}
>;

type ProviderOptions = NonNullable<
    AssistantMessage["providerOptions"]
>;

export interface TargetModel {
    providerID: string;
    modelID: string;
}

function providerOptions(
    metadata: MessageV2.ToolPart["metadata"],
    sameModel: boolean,
): ProviderOptions | undefined  {
    if (!sameModel || metadata === undefined) {
        return undefined;
    }

    const { providerExecuted: _, ...options } = metadata;

    return Object.keys(options).length > 0
        ? options
        : undefined;
}

function fileData(
    file: MessageV2.FilePart,
): { type: "url"; url: URL } {
    if (file.mime === "application/x-directory") {
        throw new Error(
            "Directory attachments must be expanded before model conversion",
        );
    }

    const url = new URL(file.url);

    if (
        url.protocol !== "data:" &&
        url.protocol !== "https:" &&
        url.protocol !== "http:"
    ) {
        throw new Error(
            `File must be materialized before model conversion: ${file.url}`
        );
    }

    return {
        type: "url",
        url: url,
    }
}

function toolOutput(
    part: MessageV2.ToolPart,
): ToolResult["output"] {
    const state = part.state;

    switch (state.status) {
        case "pending":
        case "running":
            return {
                type: "error-text",
                value: "[Tool execution was interrupted]",
            };

        case "error":
            return {
                type: "error-text",
                value: state.error,
            };

        case "completed": {
            if (state.time.compacted !== undefined) {
                return {
                    type: "text",
                    value: "[Old tool result content cleared]",
                };
            }

            const attachments = state.attachments ?? [];

            if (attachments.length === 0) {
                return {
                    type: "text",
                    value: state.output,
                };
            }

            return {
                type: "content",
                value: [
                    {
                        type: "text",
                        text: state.output,
                    },
                    ...attachments.map((file) => ({
                        type: "file" as const,
                        mediaType: file.mime,
                        data: fileData(file),
                    })),
                ],
            };
        }
    }
}

export function toModelMessage(
    history: readonly MessageV2.WithParts[],
    model: TargetModel
): ModelMessage[] {
    const result: ModelMessage[] = [];

    for (const message of history) {
        if (message.info.role === "user") {
            const content: UserContent = [];

            for (const part of message.parts) {
                switch (part.type) {
                    case "text": {
                        if (!part.ignored && part.text !== "") {
                            content.push({
                                type: "text",
                                text: part.text,
                            }); 
                        }
                        break;
                    }

                    case "file": {
                        content.push({
                            type: "file",
                            mediaType: part.mime,
                            filename: part.filename,
                            data: fileData(part),
                        })
                    }

                    case "compaction":
                    case "subtask":
                        throw new Error(
                            `${part.type} requires Prompt orchestration`
                        );

                    default:
                        break;
                }
            }

            
            if (content.length > 0) {
                result.push({
                    role: "user",
                    content,
                });
            }

            continue;
        }

        const info = message.info;

        if (info.error !== undefined && !MessageV2.AbortedError.isInstance(info.error)) {
            continue;
        }

        const sameModel = 
            info.providerID === model.providerID && 
            info.modelID === model.modelID;

        const hasSignedReasoningPart = 
            sameModel &&
            message.parts.some(
                (part) => 
                    part.type === "reasoning" && part.metadata?.anthropic?.signature != null,
            );
        
        let assistant: AssistantContent = [];
        let tools: ToolMessage["content"] = [];

        const flush = (): void => {
            if (assistant.length > 0) {
                result.push({
                    role: "assistant",
                    content: assistant,
                });
            }

            if (tools.length > 0) {
                result.push({
                    role: "tool",
                    content: tools,
                });
            }

            assistant = [];
            tools = [];
        };

        for (const part of message.parts) {
            switch (part.type) {
                case "step-start":
                    flush();
                    break;

                case "text": {
                    if (part.ignored) break;

                    const text =
                        part.text === "" && hasSignedReasoningPart
                        ? " "
                        : part.text;
                    
                    if (text === "") break;

                    assistant.push({
                        type: "text",
                        text,
                        providerOptions: providerOptions(
                            part.metadata,
                            sameModel,
                        )
                    });
                    break;
                }

                case "reasoning": {
                    if (!sameModel) {
                        if (part.text.trim() !== "") {
                            assistant.push({
                                type: "text",
                                text: part.text,
                            });
                        }
                        break;
                    }

                    assistant.push({
                        type: "reasoning",
                        text: part.text,
                        providerOptions: providerOptions(
                            part.metadata,
                            true,
                        )
                    });
                    break;
                }

                case "tool": {
                    const options = providerOptions(
                        part.metadata,
                        sameModel,
                    );

                    const providerExecuted = part.metadata?.providerExecuted === true;

                    assistant.push({
                        type: "tool-call",
                        toolCallId: part.callID,
                        toolName: part.tool,
                        input: part.state.input,
                        providerExecuted,
                        providerOptions: options,
                    });

                    const ToolResult: ToolResult = {
                        type: "tool-result",
                        toolCallId: part.callID,
                        toolName: part.tool,
                        output: toolOutput(part),
                    };

                    if (providerExecuted) {
                        assistant.push(ToolResult)
                    } else {
                        tools.push(ToolResult);
                    }

                    break;
                }

                case "file":{
                    assistant.push({
                        type: "file",
                        mediaType: part.mime,
                        filename: part.filename,
                        data: fileData(part),
                    });
                    break;
                }

                case "compaction":
                case "subtask":
                    throw new Error(
                        `${part.type} requires Prompt orchestration`,
                    );

                case "agent":
                case "snapshot":
                case "step-finish":
                case "patch":
                case "retry":
                    break;
            }
        }

        flush();
    }

    return result;
}