import "dotenv/config";

import { useSyncExternalStore } from "react";
import { render } from "ink";

import { resolve } from "node:path";

import { MessageV2 } from "../session/message-v2.js";
import { toError } from "../util/error.js";

import { App } from "./app.js";

import {
    createController,
    type TuiController
} from "./controller.js";

type ConnectedAppProps = {
    controller: TuiController;
    onExit: () => void;
};

function ConnectedApp({
    controller,
    onExit,
}: ConnectedAppProps) {
    const state = useSyncExternalStore(
        controller.subscribe,
        controller.getSnapshot,
    );

    return (
        <App
            project={state.project}
            sessionTitle={state.sessionTitle}
            messages={state.messages}
            busy={state.busy}
            closing={state.closing}
            error={state.error}
            onSubmit={controller.send}
            onCancel={controller.cancel}
            onExit={onExit}
        />
    );
}

async function main() {
    const root = process.cwd();
    const model = "deepseek/deepseek-flash"

    if (!model) {
        throw new Error()
    };

    const configuredSession = "ses_1f8108bd1001lDP95jfE0G331W";
    const providerConfig = resolve(root, process.env.SGCODING_PROVIDER_CONFIG ?? "default-provider.yaml");

    const controller = await createController({
        root,
        model,
        providerConfig,
        sessionID: configuredSession ? 
            MessageV2.SessionID.make(configuredSession)
            : undefined,
        agent: {
            name:"build",
            native: true,
            hidden: false,

            prompt: [
                "你是一个帮助用户理解和修改当前项目的编程助手。",
                "需要了解文件内容时使用提供的工具。",
                "不要声称执行了实际没有执行的操作。"
            ].join("/n"),

            temperature: 0.2,
            model
        },
    });

    let ui: ReturnType<typeof render> | undefined;

    const quit = () => {
        void controller.close().then(
            () => { ui?.unmount(); },

            (error: unknown) => {
                ui?.unmount();
                console.error(toError(error).message);
                process.exitCode = 1;
            },
        );
    };

    process.once("SIGTERM", quit);

    try {
        ui = render(
            <ConnectedApp
                controller = {controller}
                onExit={quit}
            />,
            {
                exitOnCtrlC: false,
            }
        )

        await ui.waitUntilExit();
    } finally {
        process.removeListener("SIGTERM", quit);
        ui?.unmount();

        await controller.close()
    }
}

main().catch((error: unknown) => {
    console.error(toError(error).message);
    process.exitCode = 1;
});