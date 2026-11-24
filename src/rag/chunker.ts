import { parse } from "@babel/parser";
import type { Node } from "@babel/types";

export type SourceChunk = {
    startLine: number;
    endLine: number;
    symbol: string;
    text: string;
};

const MAX_LINES = 40;
const MAX_CHARS = 4800;

function symbolName(node: Node): string | undefined {
    switch (node.type) {
        case "ClassDeclaration":
        case "FunctionDeclaration":
        case "TSInterfaceDeclaration":
        case "TSTypeAliasDeclaration":
            return node.id?.name;
        case "VariableDeclarator":
            if (node.id.type === "Identifier" &&
                (node.init?.type === "ArrowFunctionExpression" || node.init?.type === "FunctionExpression")) {
                return node.id.name;
            }
            break;
        case "ObjectMethod":
        case "ClassMethod":
            if (node.key.type === "Identifier") return node.key.name;
    }
}

function isNode(value: unknown): value is Node {
    return typeof value === "object" && value !== null && "type" in value && "loc" in value;
}

function codeSymbols(path: string, source: string, symbols: string[]) {
    let program;
    try {
        program = parse(source, {
            sourceType: "unambiguous",
            plugins: path.endsWith(".tsx") ? ["typescript", "jsx", "decorators-legacy"] : ["typescript", "decorators-legacy"],
        }).program;
    } catch (error) {
        // An unfinished edit can still be searched by line.
        if (error instanceof SyntaxError) return;
        throw error;
    }

    function visit(node: Node) {
        const name = symbolName(node);
        if (name && node.loc) {
            const { start, end } = node.loc;
            symbols.fill(name, start.line - 1, end.line);
            if (end.line - start.line + 1 <= MAX_LINES) return;
        }
        for (const value of Object.values(node)) {
            if (isNode(value)) visit(value);
            else if (Array.isArray(value)) {
                for (const child of value) if (isNode(child)) visit(child);
            }
        }
    }
    visit(program);
}

function markdownSymbols(lines: string[], symbols: string[]) {
    let heading = "";
    let fence = "";
    for (const [index, line] of lines.entries()) {
        const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
        if (marker) {
            if (!fence) fence = marker[1];
            else if (marker[1].startsWith(fence) && !marker[2].trim()) fence = "";
        } else if (!fence) {
            const match = /^ {0,3}#{1,6}\s+(.+)/.exec(line);
            if (match) heading = match[1].trim();
        }
        symbols[index] = heading;
    }
}

/** One-based, inclusive line ranges. Each nonblank source line occurs in one chunk. */
export function chunkSource(path: string, source: string): SourceChunk[] {
    const lines = source.split(/\r\n|\r|\n/);
    if (lines.at(-1) === "") lines.pop();
    const symbols = new Array<string>(lines.length).fill("");
    if (path.endsWith(".md")) markdownSymbols(lines, symbols);
    else codeSymbols(path, source, symbols);

    const chunks: SourceChunk[] = [];
    let start = 0;
    while (start < lines.length) {
        let end = start + 1;
        let chars = lines[start].length;
        while (end < lines.length && symbols[end] === symbols[start] && end - start < MAX_LINES) {
            chars += lines[end].length + 1;
            if (chars > MAX_CHARS) break;
            end++;
        }
        const text = lines.slice(start, end).join("\n");
        if (text.trim()) chunks.push({ startLine: start + 1, endLine: end, symbol: symbols[start], text });
        start = end;
    }
    return chunks;
}
