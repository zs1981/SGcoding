import Database from "better-sqlite3";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, realpath } from "node:fs/promises";
import { extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { chunkSource, type SourceChunk } from "./chunker.js";
import { userDirectory } from "../config.js";

const execFileAsync = promisify(execFile);
const segmenter = new Intl.Segmenter("zh", { granularity: "word" });
const extensions = new Set([".ts", ".tsx", ".md"]);
const excludedDirs = new Set(["node_modules", "dist", "build", "coverage", "vendor", "data"]);
const maxFileBytes = 1024 * 1024;

function terms(text: string): string[] {
    const result: string[] = [];
    for (const [word] of text.matchAll(/[A-Za-z0-9]+|[\p{Script=Han}]+|[\p{L}\p{N}]+/gu)) {
        if (/\p{Script=Han}/u.test(word)) {
            for (const item of segmenter.segment(word)) {
                if (item.isWordLike) result.push(item.segment);
            }
        } else {
            result.push(word.toLowerCase());
            const split = word.replace(/([A-Z])([A-Z][a-z])/g, "$1 $2").replace(/([a-z0-9])([A-Z])/g, "$1 $2");
            if (split !== word) result.push(...split.toLowerCase().split(" "));
        }
    }
    return result;
}

async function projectFiles(root: string, signal?: AbortSignal) {
    let stdout: string;
    try {
        ({ stdout } = await execFileAsync("git", [
            "ls-files", "--cached", "--others", "--exclude-standard", "-z", "--", ".",
        ], { cwd: root, signal, maxBuffer: 32 * 1024 * 1024 }));
    } catch (error) {
        if (signal?.aborted) throw error;
        const failure = error as NodeJS.ErrnoException & { stderr?: string };
        if (failure.stderr?.includes("not a git repository")) {
            throw new Error("当前目录不是 Git 工作区，无法检索项目源码。普通聊天不需要检索；如需源码问答，请先在目标 Git 工作区启动。", { cause: error });
        }
        if (failure.code === "ENOENT") {
            throw new Error("未找到 Git，无法检索项目源码。请安装 Git 后重试；普通聊天不受影响。", { cause: error });
        }
        throw error;
    }
    return new Set(stdout.split("\0").filter((path) =>
        extensions.has(extname(path)) &&
        !path.split("/").some((part) => part.startsWith(".") || excludedDirs.has(part))
    ));
}

async function loadSource(root: string, path: string, signal?: AbortSignal) {
    const file = resolve(root, path);
    try {
        const stat = await lstat(file);
        if (!stat.isFile() || stat.size > maxFileBytes) return;
        const canonical = await realpath(file);
        const local = relative(root, canonical);
        if (isAbsolute(local) || local === ".." || local.startsWith(".." + sep)) return;
        const bytes = await readFile(canonical, { signal });
        if (bytes.length <= maxFileBytes && !bytes.includes(0)) return bytes;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
}

export type SearchHit = Omit<SourceChunk, "symbol"> & { path: string };

/** Keep each file and all of its chunks at one version, including after an interrupted refresh. */
export async function searchProject(root: string, query: string, signal?: AbortSignal): Promise<SearchHit[]> {
    signal?.throwIfAborted();
    if (query.trim().length === 0 || query.length > 300) throw new Error("请输入 1 到 300 个字符的检索词");
    const tokens = [...new Set(terms(query))].slice(0, 32);
    if (!tokens.length) return [];
    const canonicalRoot = await realpath(root);
    const paths = await projectFiles(canonicalRoot, signal);
    const cache = join(process.env.SGCODING_RAG_CACHE_DIR || join(userDirectory(), "cache"), "sgcoding-rag-v1");
    await mkdir(cache, { recursive: true, mode: 0o700 });
    const key = createHash("sha256").update(canonicalRoot).digest("hex");
    const db = new Database(join(cache, key + ".sqlite"));
    try {
        db.pragma("journal_mode = WAL");
        db.exec(`
            CREATE TABLE IF NOT EXISTS files(path TEXT PRIMARY KEY, hash TEXT NOT NULL);
            CREATE VIRTUAL TABLE IF NOT EXISTS chunks USING fts5(
                names, body, path UNINDEXED, startLine UNINDEXED, endLine UNINDEXED, text UNINDEXED
            );
        `);
        const known = db.prepare("SELECT path FROM files").all() as { path: string }[];
        const find = db.prepare("SELECT hash FROM files WHERE path = ?");
        const save = db.prepare("INSERT OR REPLACE INTO files VALUES (?, ?)");
        const removeChunks = db.prepare("DELETE FROM chunks WHERE path = ?");
        const removeFile = db.prepare("DELETE FROM files WHERE path = ?");
        const insert = db.prepare("INSERT INTO chunks VALUES (?, ?, ?, ?, ?, ?)");
        const replace = db.transaction((path: string, hash: string, source: string) => {
            const current = find.get(path) as { hash: string } | undefined;
            if (current?.hash === hash) return;
            if (current) removeChunks.run(path);
            for (const chunk of chunkSource(path, source)) {
                const names = terms(path + " " + chunk.symbol).join(" ");
                insert.run(names, terms(chunk.text).join(" "), path, chunk.startLine, chunk.endLine, chunk.text);
            }
            save.run(path, hash);
        });
        for (const path of paths) {
            signal?.throwIfAborted();
            const bytes = await loadSource(canonicalRoot, path, signal);
            if (!bytes) {
                paths.delete(path);
                continue;
            }
            const hash = createHash("sha256").update(bytes).digest("hex");
            replace.immediate(path, hash, bytes.toString("utf8"));
        }
        signal?.throwIfAborted();
        db.transaction(() => {
            for (const { path } of known) {
                if (!paths.has(path)) {
                    removeChunks.run(path);
                    removeFile.run(path);
                }
            }
        }).immediate();
        const codeWords = [...query.matchAll(/[A-Za-z][A-Za-z0-9_]*/g)].map(([word]) => word);
        const identifiers = codeWords.filter((word) => /[a-z][A-Z]|[A-Z]_[A-Z]/.test(word));
        const phrase = (word: string) => '"' + word.toLowerCase().replaceAll("_", " ") + '"';
        // A named symbol must exist. Other query terms can point to its callers or related evidence.
        if (identifiers.length && !db.prepare("SELECT 1 FROM chunks WHERE chunks MATCH ? LIMIT 1")
            .get(identifiers.map(phrase).join(" OR "))) return [];
        const rankedTerms = identifiers.length ? codeWords : tokens;
        const match = [...new Set(rankedTerms.map(phrase))].join(" OR ");
        return db.prepare(`
            SELECT path, startLine, endLine, text FROM chunks WHERE chunks MATCH ?
            ORDER BY bm25(chunks, 1, 2), path, startLine LIMIT 5
        `).all(match) as SearchHit[];
    } finally {
        db.close();
    }
}
