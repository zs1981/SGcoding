import { open, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { jsonSchema, tool } from "ai";
import { Schema } from "effect";

import { toError } from "../util/error.js";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

const MAX_OUTPUT_BYTES = 50 * 1024;

const MAX_LINE_LENGTH = 2000;

const MAX_LINES = 2000;

const READ_TIMEOUT_MS = 15_000;

const ReadInput = Schema.Struct({
    filePath: Schema.String.check(
        Schema.isMinLength(1),
        Schema.isMaxLength(4096),
    ),

    offset: Schema.Number.check(
        Schema.isInt(),
        Schema.isBetween({
            minimum: 1,
            maximum: 2_147_483_647,
        }),
    ),

    limit: Schema.Number.check(
        Schema.isInt(),
        Schema.isBetween({
            minimum: 1,
            maximum: MAX_LINES,
        }),
    ),
});

export type ReadInput = Schema.Schema.Type<typeof ReadInput>;

export type ReadResult = {
    path: string;
    text: string;
    lineStart: number;
    lineEnd: number;
    totalLines: number;
    truncated: boolean;
}

const decodeInput = Schema.decodeUnknownSync(ReadInput);

const inputSchema = jsonSchema<ReadInput>(
    {
        type: "object",

        properties: {
            filePath: {
                type: "string",
                minLength: 1,
                maxLength: 4096,
                description: [
                    "Path to a UTF-8 text file inside the project root",
                    "Relative paths are resolved from the project root",
                ].join(" "),
            },

            offset: {
                type: "integer",
                minimum: 1,
                maximum: 2_147_483_647,
                description: "First line to read, starting from 1.",
            },

            limit: {
                type: "integer",
                minimum: 1,
                maximum: MAX_LINES,
                description: "Maximum number of lines to return.",
            }
        },

        required: ["filePath", "offset", "limit"],
        additionalProperties: false,
    },

    {
        validate(value) {
            try {
                return {
                    success: true,
                    value: decodeInput(value),
                }; 
            } catch(error) {
                return {
                    success: false,
                    error: toError(error),
                };
            }
        },
    },
);

async function readText(
    root: string,
    input: ReadInput,
    abortSignal?: AbortSignal, //
): Promise<ReadResult> {
    const signal = AbortSignal.any([
        AbortSignal.timeout(READ_TIMEOUT_MS),
        ...(abortSignal ? [abortSignal] : []),
    ]);

    signal.throwIfAborted();

    const rootPath = await realpath(resolve(root));

    const filePath = await realpath(
        resolve(rootPath, input.filePath),
    );

    const relativePath = relative(rootPath, filePath);

    if (
        relativePath === ".." ||
        relativePath.startsWith(`..${sep}`) ||
        isAbsolute(relativePath)
    ) {
        throw new Error("文件不在项目目录内");
    }

    signal.throwIfAborted();

    const file = await open(filePath, "r");

    let content: string;

    try {
        const stat = await file.stat();

        if (!stat.isFile()) {
            throw new Error("");
        } // 

        if (stat.size > MAX_FILE_BYTES) {
            throw new Error();
        }

        const chunks: Buffer[] = [];

        let totalBytes = 0;

        const stream = file.createReadStream({
            autoClose: false,
            signal,
        });

        try {
            for await (const chunk of stream) {
                const buffer = Buffer.isBuffer(chunk)
                    ? chunk
                    : Buffer.from(chunk);

                totalBytes += buffer.length;

                if (totalBytes > MAX_FILE_BYTES) {
                    throw new Error();
                }

                chunks.push(buffer)
            }
        } finally {
            stream.destroy();
        }

        signal.throwIfAborted();

        content = new TextDecoder("utf-8", {
            fatal: true,
        }).decode(Buffer.concat(chunks));
    } finally {
        await file.close();
    }
        

    if (content.includes("\0")) {
        throw new Error()
    }

    const lines = content === ""
        ? []
        : content.split(/\r\n|\n|\r/);

    if (lines.at(-1) === "") {
        lines.pop();
    }

    const emptyFile = lines.length === 0;

    if (
        input.offset > lines.length &&
        !(emptyFile && input.offset === 1)
    ) {
        throw new Error(
            
        );
    }

    const start = input.offset - 1;

    const end = Math.min(
        lines.length,
        start + input.limit,
    );

    const selected: string[] = [];

    let outputBytes = 0;
    let truncated = end < lines.length;

    for (let index = start; index < end; index++) {
        const original = lines[index]!;
        const tooLong = original.length > MAX_LINE_LENGTH;

        const text = tooLong
            ? `${original.slice(0, MAX_LINE_LENGTH)} ... [line truncated]`
            : original;

        const numbered = `${index + 1}: ${text}`;

        const bytes = Buffer.byteLength(numbered, "utf-8") + (selected.length > 0 ? 1 : 0);

        if (outputBytes + bytes > MAX_OUTPUT_BYTES) {
            truncated = true;
            break;
        }

        selected.push(numbered);
        outputBytes += bytes;

        if (tooLong) {
            truncated = true;
        }
    }

    signal.throwIfAborted();

    return {
        path: filePath,
        text: selected.join("\n"),

        lineStart: selected.length > 0
            ? input.offset
            : 0,
        
        lineEnd: selected.length > 0
            ? input.offset + selected.length - 1
            : 0,

        totalLines: lines.length,

        truncated,
    }
}

export function createReadTool(root: string) {
    return tool({
        description: [
            "Read a UTF-8 text file inside the project root.",
            "Path may be absolute or relative to the project root.",
            "Line numbers start at 1.",
            "Use offset=1 to read from the beginning.",
            `Return at most ${MAX_LINES} lines per call.`,
            "Files must not exceed 10 MiB.",
            "Long lines and large output maybe truncated.",
        ].join(" "),

        inputSchema, 

        execute: async (input, options) => {
            const result = await readText(
                root,
                input,
                options.abortSignal,
            );

            return {
                title: result.path,
                
                output: [
                    `Path: ${result.path}`,
                    `Lines: ${result.lineStart} - ${result.lineEnd} of ${result.totalLines}`,
                    result.text,
                    result.truncated
                        ? "[Output truncated]"
                        : "",
                ]
                    .filter((line) => line !== "")
                    .join("\n"),
                
                metadata: {
                    path: result.path,
                    lineStart: result.lineStart,
                    lineEnd: result.lineEnd,
                    totalLines: result.totalLines,
                    truncated: result.truncated,
                }
            };
        },
    });
}
