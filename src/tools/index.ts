import type { ToolSet } from "ai";
import { hasGitWorkspace } from "../workspace.js";

import { createReadTool } from "./read.js";
import { createSearchProjectTool } from "./search-project.js";

export function createTools(root: string): ToolSet {
    if (!hasGitWorkspace(root)) return {};

    return {
        read: createReadTool(root),
        search_project: createSearchProjectTool(root),
    };
}
