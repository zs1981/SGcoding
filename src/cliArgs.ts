import { Command } from "commander";

export type CliOptions =
    | {
        command: "delete";
        sessionId: string;
    }
    | {
        command: "archive";
        sessionId: string;
    }
    | {
        command: "run";
        data: {
            sessionId?: string,
            modelId: string,
            input: string,
        };
    }
    | {
        command: "list";
    }
    | {
        command: "unarchive";
        sessionId: string;
    };


export function parseArgs(args: readonly string[]): CliOptions {
    const program = new Command();

    let Option: CliOptions | undefined;

    program
        .name("sgcoding")
        .description("SGcoding command line interface")
        .version("0.0.1")
        .showHelpAfterError();
    

    program
        .command("run")
        .description("chat with models")
        .option("--session <sessionId>", "session")
        .option("--model <modelId>", "model", "doubao-seed-2-0-mini-260428")
        .argument("[input...]", "input message")
        .action(
            (
                inputParts: string[],
                {
                    session: sessionId,
                    model: modelId,
                }: {
                    session?: string,
                    model: string,
                }
            ) => {
                Option = {
                    command:"run",
                    data: {
                        sessionId: sessionId,
                        modelId: modelId,
                        input: inputParts.join(" ").trim(),
                    },
                };
            }
        );


    const session = program
        .command("session")
        .description("")

    session
        .command("delete")
        .description("delete a session")
        .argument("[session-id]")
        .allowExcessArguments(false)
        .action((sessionId: string) => {
            Option = {
                command: "delete",
                sessionId: sessionId,
            };
        });
    
    session
        .command("archive")
        .description("achive a session")
        .argument("[sessionId]")
        .action((sessionId: string) => {
            Option = {
                command: "archive",
                sessionId: sessionId,
            }
        });
    
    session
        .command("unarchive")
        .argument("[sessionId]")
        .action((sessionId: string) => {
            Option = {
                command: "unarchive",
                sessionId: sessionId,
            }
        })
    
    session
        .command("list")
        .description("list sessions")
        .action(() => {
            Option = {
                command: "list"
            }
        });
      
    program.parse(args, { from: "user" });

    if (Option == undefined) {
        return program.help();
    }
    
    return Option;
}   