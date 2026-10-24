import { Effect } from "effect";

import type { LLMEvent } from "../model/schema/schema-events.js";
import { MessageV2 } from "./message-v2.js";
import * as Session from "./service.js";

type TextEvent = Extract<
    LLMEvent,
    {
        type: "text-start" | "text-delta" | "text-end";
    }
>;

export function makeTextHandler(
    sessions: Session.Interface,
    assistantMessage: MessageV2.Assistant,
) {
    let currentText: MessageV2.TextPart | undefined;   
    let currentTextID: string | undefined;

    const finish = (): Effect.Effect<void> => 
        Effect.gen(function*() {
            const part = currentText;

            if (!part) {
                return;
            }

            const end = Date.now();

            part.time = {
                start: part.time?.start ?? end,
                end,
            };

            yield* sessions.UpdatePart(part);

            currentText = undefined;
            currentTextID = undefined;
        });
    
    const handle = (
        event: TextEvent,
    ): Effect.Effect<void> => 
        Effect.gen(function* () {
            switch (event.type) {
                case "text-start": {
                    yield* finish();

                    const part: MessageV2.TextPart = {
                        id: MessageV2.PartID.ascending(),
                        sessionID: assistantMessage.sessionID,
                        messageID: assistantMessage.id,
                        type: "text",
                        text: "",
                        time: {
                            start: Date.now()
                        },
                        metadata: event.providerMetadata,
                    };

                    currentText = part;
                    currentTextID = event.id,

                    yield* sessions.UpdatePart(part);
                    return;
                };

                case "text-delta": {
                    const part = currentText;

                    if (!part || currentTextID !== event.id) {
                        return;
                    }

                    part.text += event.text;

                    if (event.providerMetadata !== undefined) {
                        part.metadata = event.providerMetadata;
                    }

                    yield* sessions.DeltaPart(
                        part.sessionID,
                        part.messageID,
                        part.id,
                        "text",
                        event.text,
                    );

                    return;
                }

                case "text-end": {
                    const part = currentText;

                    if (!part || currentTextID !== event.id) {
                        return;
                    }

                    if (event.providerMetadata !== undefined){
                        part.metadata = event.providerMetadata;
                    }

                    yield* finish();
                    return;
                }
            }
        });
    
    return {
        handle,
        finish,
    };
}