import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, relative, resolve } from "node:path";

// 支持仓库子目录和使用 .git 文件的 Git worktree。
export function hasGitWorkspace(root: string): boolean {
    let directory = resolve(root);
    const home = resolve(homedir());
    while (true) {
        // 主目录默认用于普通聊天，不把这里或其上层的 .git 当成项目。
        if (relative(directory, home) === "") return false;
        if (existsSync(resolve(directory, ".git"))) return true;
        const parent = dirname(directory);
        if (parent === directory) return false;
        directory = parent;
    }
}
