import { jsonSchema, tool } from "ai";
import { searchProject } from "../rag/search.js";

export function createSearchProjectTool(root: string) {
    return tool({
        description: "Find source evidence in this Git project using keywords, paths or exact TypeScript identifiers. " +
            "Returns excerpts with one-based citations. Try code identifiers or short English keywords for Chinese questions. " +
            "Use read for more context. Cite the returned paths and lines for repository claims.",
        inputSchema: jsonSchema<{ query: string }>({
            type: "object",
            properties: { query: { type: "string", minLength: 1, maxLength: 300 } },
            required: ["query"],
            additionalProperties: false,
        }),
        execute: async ({ query }, { abortSignal }) => {
            const hits = await searchProject(root, query, abortSignal);
            const citations = hits.map((hit) => `${hit.path}:${hit.startLine}-${hit.endLine}`);
            const excerpts = hits.map((hit, index) => {
                const lines = hit.text.split("\n").map((line, offset) =>
                    `${hit.startLine + offset} | ${line.length > 1000 ? line.slice(0, 1000) + "…" : line}`
                );
                return [citations[index], ...lines].join("\n");
            });
            return {
                title: `仓库检索 · ${hits.length} 个片段`,
                output: excerpts.join("\n\n") || "没有找到匹配片段。可以换用文件名、符号名或其他关键词。",
                metadata: { citations },
            };
        },
    });
}
