import type { Runtime } from "../../runtime.js";
import type { CliOptions } from "../../cliArgs.js";

type ListData = Extract<
    CliOptions,
    {command: "list"}
>["data"]

export function listCommand(
    runtime: Runtime,
    data: ListData,
): void {
    const sessions = runtime.store.list(data.maxCount, data.includeArchived);

    if (sessions.length === 0) {
        console.log("暂无 Session");
        return;
    }

    switch (data.format) {
        case "json": {
            console.log(
                JSON.stringify(sessions, null, 2),
            )

            return;
        }

        case "table": {
            console.table(
                sessions.map((session) => ({
                    id: session.id,
                    title: session.title.trim(),
                    createTime: new Date(session.timeCreate).toLocaleString("zh-CN"),
                    archiveTime: session.timeArchived === null 
                    ? "" 
                    : new Date(session.timeArchived).toLocaleString("zh-CN")
                }))
            )

            return;
        }
    }

}