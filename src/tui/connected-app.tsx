import { useState, useSyncExternalStore } from "react";
import { Box, Text } from "ink";

import { MessageV2 } from "../session/message-v2.js";
import { App } from "./app.js";
import { createCommandHandler } from "./commands.js";
import type { TuiController } from "./controller.js";
import { SelectionList, type SelectionItem } from "./selection-list.js";

type ConnectedAppProps = {
    controller: TuiController;
    onExit: () => void;
};

type Picker = {
    kind: "sessions" | "models";
    items: readonly SelectionItem[];
};

export function ConnectedApp({ controller, onExit }: ConnectedAppProps) {
    const state = useSyncExternalStore(
        controller.subscribe,
        controller.getSnapshot,
    );
    const [picker, setPicker] = useState<Picker>();

    const handleCommand = createCommandHandler({
        openSessions: () => {
            const sessions = controller.listSessions();
            if (!sessions) return false;

            setPicker({
                kind: "sessions",
                items: sessions.map((session) => ({
                    id: session.id,
                    label: session.title || "未命名会话",
                })),
            });
            return true;
        },
        openModels: () => {
            const models = controller.listModels();
            if (!models) return false;

            setPicker({
                kind: "models",
                items: models.map((model) => ({
                    id: model.id,
                    label: model.name,
                    detail: `${model.providerName} · ${model.id}`,
                })),
            });
            return true;
        },
    });

    const submit = (text: string): boolean => {
        const accepted = handleCommand(text);
        if (accepted !== undefined) return accepted;
        return controller.send(text);
    };

    if (picker) {
        return (
            <SelectionList
                key={picker.kind}
                title={picker.kind === "sessions" ? "选择会话" : "选择模型"}
                items={picker.items}
                currentID={picker.kind === "sessions" ? state.sessionID : state.model}
                emptyText={picker.kind === "sessions" ? "没有未归档会话" : "没有已配置模型"}
                closing={state.closing}
                error={state.error}
                onSelect={(id) => picker.kind === "sessions"
                    ? controller.switchSession(MessageV2.SessionID.make(id))
                    : controller.switchModel(id)}
                onClose={() => setPicker(undefined)}
                onExit={onExit}
            />
        );
    }

    return (
        <Box flexDirection="column">
            <App
                project={state.project}
                projectEnabled={state.projectEnabled}
                sessionTitle={state.sessionTitle}
                model={state.model}
                messages={state.messages}
                busy={state.busy}
                closing={state.closing}
                error={state.error}
                onSubmit={submit}
                onCancel={controller.cancel}
                onExit={onExit}
            />
            <Text dimColor>输入 /sessions 切换会话 · /model 切换模型</Text>
        </Box>
    );
}
