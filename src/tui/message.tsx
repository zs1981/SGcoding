import { Box, Text } from "ink";

import type { MessageV2 } from "../session/message-v2.js";

type MessageViewProps = {
    message: MessageV2.WithParts;
};

type PartViewProps = {
    part: MessageV2.Part;
}

type ToolViewProps = {
    part: MessageV2.ToolPart;
}

function ToolView({ part }: ToolViewProps) {
    const state = part.state;

    switch (state.status) {
        case "pending":
            return (
                <Text color="yellow">
                    ○ {part.tool}: 正在接受参数
                </Text>
            );

        case "running":
            return (
                <Box flexDirection="column">
                    <Text color="yellow">
                        ◇ { part.tool }: 执行中
                    </Text>

                    {state.title && (
                        <Text dimColor>
                            {state.title}
                        </Text>
                    )}
                </Box>
            );

        case "completed":
            return(
                <Box flexDirection="column">
                    <Text color="green">
                        ✓ {part.tool}: 完成
                    </Text>

                    <Text dimColor>
                        {state.title}
                    </Text>
                    {part.tool === "search_project" && Array.isArray(state.metadata?.citations) &&
                        state.metadata.citations.filter((value): value is string => typeof value === "string")
                            .map((citation) => <Text key={citation} dimColor>{citation}</Text>)}
                </Box>
            );

        case "error": 
            return (
                <Box flexDirection="column">
                    <Text color="red">
                        × {part.tool}: 失败
                    </Text>

                    <Text color="red">
                        {state.error}
                    </Text>
                </Box>
            );
    }
}

function PartView({ part }: PartViewProps) {
    switch (part.type) {
        case "text":
            if (part.ignored || part.text.length === 0) {
                return null;
            }

            return (
                <Text>
                    {part.text}
                </Text>
            );
        
        case "reasoning": 
            if (part.text.length === 0) {
                return null;
            }

            return (
                <Box flexDirection="column">
                    <Text dimColor>
                        Reasoning 
                    </Text>

                    <Text dimColor>
                        {part.text}
                    </Text>
                </Box>
            )

        case "tool":
            return <ToolView part={part} />; //

        case "file": 
            return (
                <Text color="cyan">
                    附件： {part.filename ?? part.url}
                </Text>
            );

        default:
            return null;
    }
}

export function MessageView({ message }: MessageViewProps ) {
    const isUser = message.info.role === "user";

    return (
        <Box
            flexDirection="column"
            marginBottom={1}
        >
            <Text
                bold
                color={isUser ? "cyan" : "green"}
            >
                {isUser ? "你" : "SGcoding"}
            </Text>

            <Box
                flexDirection="column"
                paddingLeft={2}
                gap={1}
            >
                {message.parts.map((part) => (
                    <PartView
                        key={part.id}
                        part={part}
                    ></PartView>
                ))}

                {message.info.role === "assistant" &&
                    message.info.error !== undefined && (
                        <Text color="red">
                            消息异常： {message.info.error.name}
                        </Text>
                    )
                }
            </Box>
        </Box>
    )
}
