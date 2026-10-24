import { Effect, Layer, Context, ManagedRuntime } from "effect";
import * as Session from "../session/service.js";
import * as Store from "../session/store.js";
import * as Stream from "effect/Stream";
import * as LLM from "../model/llm.js";

const LLMTestLayer = Layer.succeed(
    LLM.Service,
    LLM.Service.of({
        stream: () =>
            Stream.make<LLM.LLMEvent[]>(
                {
                    type: "text-start",
                    id: "text_test",
                },
                {
                    type: "text-delta",
                    id: "text_test",
                    text: "你好，",
                },
                {
                    type: "text-end",
                    id: "text_test",
                },
            ),
    }),
);

const TestLayer = Layer.mergeAll(
    Session.testLayer,
    Store.testLayer,
    LLMTestLayer,
)

const runtime = ManagedRuntime.make(TestLayer);

const program = Effect.gen(function* () {
    const sessions = yield* Session.Service;
    const store = yield* Store.Service;
    const llm = yield* LLM.Service;

    const sessionID = yield* sessions.createSession("Layer test")

    yield* sessions.appendMessage(sessionID, {
        role: "user",
        content: "hello"
    })

    const events = llm.stream({
        model: "test/fake",
        messages: [
            {
            role: "user",
            content: "hello",
            },
        ],
    });

    let reply =  "";

    yield* Stream.runForEach(events, (event) => 
        Effect.sync(() => {
            if (event.type === "text-delta") {
                reply += event.text;
            }
        })
    )

    yield* sessions.appendMessage(sessionID, {
    role: "assistant",
    content: reply,
    });

    const session = yield* store.get(sessionID);
    const messages = yield* store.context(sessionID);

    console.log("会话：", session);
    console.log("消息：", messages);
});

try {
    await runtime.runPromise(program);
} finally {
    await runtime.dispose();
}