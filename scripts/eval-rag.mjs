import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { searchProject } from "../src/rag/search.ts";

const repo = fileURLToPath(new URL("../", import.meta.url));
const suite = JSON.parse(await readFile(new URL("../eval/rag/questions.json", import.meta.url)));
const parent = await realpath(tmpdir());
const temp = await mkdtemp(join(parent, "sgcoding-eval-"));
const snapshot = join(temp, "snapshot");
process.env.SGCODING_RAG_CACHE_DIR = temp;

try {
    execFileSync("git", ["clone", "--quiet", "--local", "--no-checkout", "--", repo, snapshot]);
    execFileSync("git", ["checkout", "--quiet", "--detach", suite.revision], { cwd: snapshot });
    let complete = 0;
    let answerable = 0;
    let empty = 0;
    console.log("源码版本", suite.revision);
    for (const { question, evidence } of suite.questions) {
        const hits = await searchProject(snapshot, question);
        const found = evidence.filter(([path, line]) =>
            hits.some(hit => hit.path === path && hit.startLine <= line && line <= hit.endLine)
        ).length;
        if (evidence.length) {
            answerable++;
            if (found === evidence.length) complete++;
        } else if (!hits.length) {
            empty++;
        }
        console.log(question, evidence.length ? `证据 ${found}/${evidence.length}` : `无答案题，返回 ${hits.length} 个候选`);
    }
    console.log(`前五个片段集齐全部证据：${complete}/${answerable}；无答案题零候选：${empty}/${suite.questions.length - answerable}`);
} finally {
    if (dirname(await realpath(temp)) === parent) await rm(temp, { recursive: true, force: true });
}
