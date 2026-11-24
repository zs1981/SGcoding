export type CommandActions = {
    openSessions: () => boolean;
    openModels: () => boolean;
};

export function createCommandHandler(actions: CommandActions) {
    const commands = new Map<string, () => boolean>([
        ["/sessions", actions.openSessions],
        ["/model", actions.openModels],
    ]);

    return (text: string): boolean | undefined => {
        const command = commands.get(text);
        if (!command) {
            return undefined;
        }

        return command();
    };
}
