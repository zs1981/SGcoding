import assert from "node:assert/strict";
import { Effect, ManagedRuntime } from "effect";
import  { Database} from "../database/index.js";

const runtime = ManagedRuntime.make(Database.defaultLayer);

const program = Effect.gen(function* (){
    const {client} = yield* Database.Service;

    const rows = yield* Effect.sync(() =>
        client
            .prepare(`
                SELECT name
                FROM sqlite_master
                WHERE type = 'table'
                ORDER BY name
            `)
            .all() as Array<{ name: string }>,
    );

    const tableNames = new Set(rows.map((row) => row.name));

    assert.ok(tableNames.has("message"), "lost message table");
    assert.ok(tableNames.has("part"), "lost part table");
    assert.ok(!tableNames.has("session_message"), "旧 session_message 表尚未删除",);

    console.log(rows);
})

try {
    await runtime.runPromise(program);
} finally {
    await runtime.dispose();
}