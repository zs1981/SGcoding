import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rm, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { 
    Effect,
    Fiber,
    Layer,
    ManagedRuntime,
    Stream,
} from "effect";

import { Database } from "../database/index.js";
import {
    EventSequenceTable,
    EventTable
} from "../database/schema.js";
import * as Event from "../event/service.js";
import * as Session from "../session/service.js";
import * as Store from "../session/store.js";
import { MessageV2 } from "../session/message-v2.js";

function makeRuntime(path: string) {
    const database = Database.makeLayer(path);
    
    const events = Event.layer.pipe(
        Layer.provideMerge(database)
    );

    return ManagedRuntime.make(
        Layer.mergeAll(
            Session.layer.pipe(
                Layer.provideMerge(events)
            ),
            Store.layer.pipe(
                Layer.provideMerge(database)
            ),
        )
    );
}

function seed() {
    return Effect.gen(function* () {
        const sessions = yield* Session.Service;

        const sessionID = yield* sessions.createSession(
            "persistence test"
        );

        const info: MessageV2.User = {
            id: MessageV2.MessageID.ascending(),
            sessionID,
            role: "user",
            time: {
                created: Date.now(),
            },
            agent: "test",
            model: {
                providerID: MessageV2.ProviderID.make("test"),
                modelID: MessageV2.ModelID.make("fake"),
            },
        };

        const part: MessageV2.TextPart = {
            id: MessageV2.PartID.ascending(),
            sessionID,
            messageID: info.id,
            type: "text",
            text: "",
        }

        yield* sessions.updateMessage(info);
        yield* sessions.updatePart(part);

        return { sessionID, info, part };
    });
}

test("delta 正确通知订阅者，且不修改持久化状态", async () => {
    const runtime = makeRuntime(":memory:");

    try {
        await runtime.runPromise(
            Effect.scoped(  // 可以不要，服务归runtime管理
                Effect.gen(function* () {
                    const sessions = yield* Session.Service;
                    const events = yield* Event.Service;
                    const store = yield* Store.Service;
                    const { db } = yield* Database.Service;

                    const {
                        sessionID,
                        info,
                        part,
                    } = yield* seed();

                    const typedFiber = yield* events
                        .subscribe("message.part.delta")
                        .pipe(
                            Stream.take(1),
                            Stream.runCollect,
                            Effect.forkChild({
                                startImmediately: true,
                            }),
                        );

                    const allFiber = yield* events.all().pipe(
                        Stream.take(2),
                        Stream.runCollect,
                        Effect.forkChild({
                            startImmediately: true,
                        }),
                    );

                    yield* sessions.setTitle(
                        sessionID,
                        "update title",
                    );

                    const before = {
                        events: db
                            .select()
                            .from(EventTable)
                            .all(),
                        sequence: db
                            .select()
                            .from(EventSequenceTable)
                            .all(),
                    };

                    const input = {
                        sessionID,
                        messageID: info.id,
                        partID: part.id,
                        field: "text",
                        delta: "hello",
                    };

                    yield* sessions.updatePartDelta(
                        input.sessionID,
                        input.messageID,
                        input.partID,
                        input.field,
                        input.delta,
                    );

                    const typedEvents = yield* Fiber.join(typedFiber);

                    const allEvents = yield* Fiber.join(allFiber);
 
                    assert.equal(typedEvents.length, 1);

                    assert.deepEqual(
                        typedEvents[0].data,
                        input,
                    );
                    assert.equal(
                        "seq" in typedEvents[0],
                        false,
                    );

                    assert.deepEqual(
                        allEvents.map((event) => event.type),
                        ["title.set", "message.part.delta"],
                    );

                    assert.equal(
                        allEvents[1].eventId,
                        typedEvents[0].eventId,
                    );

                    assert.deepEqual(
                        db.select().from(EventTable).all(),
                        before.events,
                    );
                    assert.deepEqual(
                        db.select().from(EventSequenceTable).all(),
                        before.sequence,
                    );

                    assert.deepEqual(
                        (yield* store.context(sessionID))[0].parts,
                        [part],
                    );

                    const completedPart = {
                        ...part,
                        text: input.delta,
                    };

                    yield* sessions.updatePart(completedPart);

                    assert.deepEqual(
                        (yield* store.context(sessionID))[0].parts,
                        [completedPart],
                    );

                })
            ).pipe(
                Effect.timeout("5 seconds"),
            )
        );
    } finally {
        await runtime.dispose();
    }
})


test("关闭并重新打开数据库后，Message 和 Part 可以恢复", async () => {
    const tempRoot = resolve(tmpdir());

    const directory = mkdtempSync(
        join(tempRoot, "sgcoding-session-test-"),
    )

    const databasePath = join(directory, "session.db");

    try {
        const first = makeRuntime(databasePath);

        const saved = await (async () => {
            try {
                return await first.runPromise(
                    Effect.gen(function* () {
                        const fixture = yield* seed();
                        const sesisons = yield* Session.Service;

                        const part = {
                            ...fixture.part,
                            text: "saved text",
                        };

                        yield* sesisons.updatePart(part);

                        const { db } = yield* Database.Service;

                        return {
                            ...fixture,
                            part,
                            events: db
                                .select()
                                .from(EventTable)
                                .all(),
                            sequences: db
                                .select()
                                .from(EventSequenceTable)
                                .all(),
                        };
                    }),
                );
            } finally {
                await first.dispose();
            }
        })();

        const second = makeRuntime(databasePath);

        try {
            await second.runPromise(
                Effect.gen(function* () {
                    const store = yield* Store.Service;

                    const { db } = yield* Database.Service;

                    assert.deepEqual(
                        yield* store.context(saved.sessionID),
                        [{
                            info: saved.info,
                            parts: [saved.part], // q
                        }]
                    );

                    assert.deepEqual(
                        db.select().from(EventTable).all(),
                        saved.events,
                    );

                    assert.deepEqual(
                        db.select().from(EventSequenceTable).all(),
                        saved.sequences,
                    );
                })
            );
        } finally{
            await second.dispose();
        }
    } finally{
        assert.equal(dirname(resolve(directory)), tempRoot);
        assert.ok(basename(directory).startsWith("sgcoding-session-test-"));

        rmSync(directory, {
            recursive: true,
            force: true,
        });
    }
});