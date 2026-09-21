import { 
    Command,
    Option,
    InvalidArgumentError,
} from "commander";

export type CliOptions =
    | {
        command: "delete";
        data:{
            sessionId: string;
        }
    }
    | {
        command: "archive";
        data: {
            sessionId: string;
        }
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
        data: {
            maxCount: number;
            format: "table" | "json";
            includeArchived: boolean;
        };
    }
    | {
        command: "unarchive";
        data: {
            sessionId: string;
        }
    };


export function parseArgs(args: readonly string[]): CliOptions {
    const program = new Command();

    let CliOption: CliOptions | undefined;

    program
        .name("sgcoding")
        .description("SGcoding command line interface")
        .version("0.0.3")
        .showHelpAfterError();
    

    program
        .command("run")
        .description("chat with models")
        .option("--session <session-id>", "session")  // "ses_94b9d30d-a51b-48d4-a708-ab25482043e7"
        .option("--model <model-id>", "model", "ark/doubao-seed-2-0-mini-260428")
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
                CliOption = {
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
        .argument("<sessionId>")
        .allowExcessArguments(false)
        .action((sessionId: string) => {
            CliOption = {
                command: "delete",
                data: {
                    sessionId: sessionId,
                }
            };
        });
    
    session
        .command("archive")
        .description("achive a session")
        .argument("<sessionId>")
        .action((sessionId: string) => {
            CliOption = {
                command: "archive",
                data: {
                    sessionId: sessionId,
                }
            }
        });
    
    session
        .command("unarchive")
        .argument("<session-id>")
        .action((sessionId: string) => {
            CliOption = {
                command: "unarchive",
                data: {
                    sessionId: sessionId,
                }
            }
        })
    
    session
        .command("list")
        .description("list sessions")
        .option("-m, --max-count <count>", "maximum session count", (value: string) => {
            const count = Number(value);

            if (!Number.isInteger(count) || count <= 0) {
                throw new InvalidArgumentError(
                    "must be a positive integer" 
                );
            }

            return count
        })
        .addOption(
            new Option(
                "-f, --format <format>",
                "output format",
            )
                .choices(["table", 'json'])
                .default("table")
        )
        .option("--incArc, --include-archived", "include archived sessions")
        .action(({
            maxCount = 10,
            format,
            includeArchived = false,
        } : {
            maxCount?: number,
            format: "table" | "json",
            includeArchived?: boolean,
        }) => {
            CliOption = {
                command: "list",
                data: {
                    maxCount,
                    format,
                    includeArchived,
                }
            }
        });
      
    program.parse(args, { from: "user" });

    if (CliOption == undefined) {
        return program.help();
    }
    
    return CliOption;
}   