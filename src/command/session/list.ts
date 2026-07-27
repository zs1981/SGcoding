import type { Runtime } from "../../runtime.js";

export function listCommand(
    runtime: Runtime,
): void {
    const sessions = runtime.store.list();

    if (sessions.length === 0) {
        console.log("暂无 Session");
        return;
    }

    console.log("ID\ttitle\tcreateTime");

    for (const session of sessions) {
        const title =
            session.title.trim();

        const timeCreate =
            new Date(
                session.timeCreate,
            ).toLocaleString("zh-CN");

        console.log(
            `${session.id}\t${title}\t${timeCreate}`,
        );
    }
}