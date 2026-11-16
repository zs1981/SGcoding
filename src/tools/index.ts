import type { ToolSet } from "ai";

import { createReadTool } from "./read.js";
import { read } from "node:fs";

export function createTools(root: string): ToolSet {
    return {
        read: createReadTool(root),
    };
}