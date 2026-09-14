export class SessionNotFoundError extends Error {
    readonly name = "SessionNotFoundError";

    constructor(readonly sessionId: string) {
        super(`Session(${sessionId}) not found`)
    }
}


export class SessionArchivedError extends Error {
    readonly name = "SessionArchivedError";

    constructor(readonly sessionId: string, readonly timeArchived: number) {
        const time = new Date(timeArchived).toLocaleString("zh-CN");

        super(`Session(${sessionId}) was archived at ${time}`)
    }
}