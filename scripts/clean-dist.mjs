import { rmSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = resolve(root, "dist");

if (dirname(output) !== resolve(root) || basename(output) !== "dist") {
    throw new Error("构建输出目录不在预期的项目路径中");
}

rmSync(output, { recursive: true, force: true });
