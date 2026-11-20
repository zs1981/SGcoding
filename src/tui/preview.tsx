import { useState } from "react";
import { Box, Text, render, useApp } from "ink";

import { App } from "./app.js";

function Preview() {
    const { exit } = useApp();

    const [lastInput, setLastInput] = useState("");

    return (
        <Box flexDirection="column">
            <App
                project={process.cwd()}
                sessionTitle="界面预览 · 尚未连接模型"
                messages={[]}
                busy={false}
                onSubmit={(text) => {
                    setLastInput(text);
                    return true;
                }}
                closing={false}
                onCancel={() => {}}
                onExit={() => {exit();}}
            />
        

            {lastInput.length > 0 && (
                <Box padding={1} marginTop={1}>
                    <Text dimColor>
                        最近提交的输入：{lastInput}
                    </Text>
                </Box>
            )}
        </Box>
    );
}

const app = render(
    <Preview />,
    {
        exitOnCtrlC: false,
    }
);

await app.waitUntilExit();