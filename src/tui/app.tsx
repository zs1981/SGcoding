import { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";

import type { MessageV2 } from "../session/message-v2.js";

import { MessageView } from "./message.js";

export type AppProps = {
    project: string;
    projectEnabled?: boolean;
    sessionTitle: string;
    model?: string;

    messages: readonly MessageV2.WithParts[];

    busy: boolean;
    closing: boolean;
    error?: string;

    onSubmit: (text: string) => boolean;

    onCancel: () => void;

    onExit: () => void;
};

export function App({ //
    project,
    projectEnabled = false,
    sessionTitle,
    model,
    messages,
    busy,
    closing = false,
    error,
    onSubmit,
    onCancel,
    onExit,
}: AppProps) {
    const [input, setInput] = useState("");

    const disable = busy || closing;

    useInput((value, key) => {
        if (closing) {
            return;
        }

        if (key.ctrl && value === "c") {
            if (busy) {
                onCancel();
            } else{
                onExit();
            }

            return;
        }

        if (key.escape && busy) {
            onCancel();
        }
    });

    const submit = (value: string) => {
        if (disable) {
            return;
        }

        const text = value.trim();

        if (text.length === 0) {
            return;
        }

        const accepted = onSubmit(text);

        if (accepted) {
            setInput("")
        }
    };

    return (
        <Box 
            flexDirection="column"
            paddingX={1}
        >
            <Box
                flexDirection="column"
                borderStyle="round"
                borderColor="cyan"
                paddingX={1}
                marginBottom={1}
            >
                <Text bold color="cyan">
                    SGcoding
                </Text>

                <Text>
                    {projectEnabled ? "项目" : "目录"}: {project}
                </Text>

                <Text dimColor>模式: {projectEnabled ? "项目问答" : "普通聊天"}</Text>

                <Text dimColor>
                    会话: {sessionTitle}
                </Text>
                {model && <Text dimColor>模型: {model}</Text>}
            </Box>

            <Box flexDirection="column">
                {
                    messages.length === 0 
                        ? ( <Text dimColor>
                                输入问题，开始当前会话
                            </Text>
                        ) 
                        : ( messages.map((message) => (
                                <MessageView
                                    key={message.info.id}
                                    message={message}
                                />
                            ))
                        )
                }
            </Box>

            {error && (
                <Box marginTop={1}>
                    <Text color="red">
                        {error}
                    </Text>
                </Box>
            )}

            <Box>
                <Text color={busy ? "yellow" : "gray"}>
                    {closing
                        ? "正在退出..."
                        : busy
                            ? "正在生成"
                            : "就绪"}
                </Text>
            </Box>
            
            <Box
                borderStyle="round"
                borderColor={disable ? "gray" : "cyan"}
                paddingX={1}
            >
                <Text color="cyan">
                    {"> "}
                </Text>

                <TextInput
                    value={input}
                    onChange={setInput}
                    onSubmit={submit}
                    focus={!disable}
                    showCursor={!disable}
                    placeholder={
                        closing
                            ? "正在释放资源" //
                            : busy
                                ? "等待当前问题结束"
                                : "输入问题按enter发送"
                    }
                />
            </Box>

            <Text dimColor>
                Enter 发送 · Esc 取消生成 · Ctrl+C 取消或退出
            </Text>
        </Box>
    );
}

