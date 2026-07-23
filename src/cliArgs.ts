import { Command } from "commander";

export type CliOptions =
    | {
        command: "create";
        title: string;
    }
    | {
        command: "delete";
        sessionId: string;
    }
    | {
        command: "archive";
        sessionId: string;
    }
    |{
        command: "chat";
        data: {
            sessionId: string,
            modelId: string,
            input: string,
        };
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
        .command("create")
        .description("create an new session")
        .argument("[title...]", "Session Title")
        .action((titleParts: string[] | undefined) => {
            Option = {
                command: "create",
                title: titleParts?.join(" ").trim() ?? "",
            };
        });
    
    program
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
    
    program
        .command("chat")
        .description("chat with models")
        .option("--session <sessionId>", "session_id","ses_94b9d30d-a51b-48d4-a708-ab25482043e7")
        .option("--model <modelId>", "model_id", "doubao-seed-2-0-mini-260428")
        .argument("[input...]", "input message")
        .action((inputParts: string[], {session: sessionId, model: modelId}: {session: string, model: string}) => {
            Option = {
                command: "chat",
                data: {
                    sessionId: sessionId,
                    modelId: modelId,
                    input: inputParts?.join(" ").trim() ?? "",
                },
            };
        });
    
    program
        .command("archive")
        .description("achive a session")
        .argument("[sessionId]")
        .action((sessionId: string) => {
            Option = {
                command: "archive",
                sessionId: sessionId,
            }
        });
      
    program.parse(args, { from: "user" });

    if (Option == undefined) {
        return program.help();
    }
    
    return Option;
}   