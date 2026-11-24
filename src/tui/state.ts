import type { Payload } from "../event/schema/event.js";
import { MessageV2 } from "../session/message-v2.js";

export type TuiState = {
    project: string;
    sessionID: MessageV2.SessionID;
    sessionTitle: string;
    model: string;
    messages: readonly MessageV2.WithParts[];
    busy: boolean;
    closing: boolean;
    error?: string;
}

export function applyEvent(
    state: TuiState,
    event: Payload,
): TuiState {
    switch (event.type) {
        case "title.set":
            return {
                ...state,
                sessionTitle: event.data.Title,
            };

        case "message.update": {
            const info = structuredClone(event.data.Info);

            const exists = state.messages.some(
                (message) => message.info.id === info.id,
            )

            return {
                ...state,

                messages: exists
                    ? state.messages.map((message) => 
                        message.info.id === info.id
                        ? { ...message, info }
                        : message,
                    )
                    : [
                        ...state.messages,
                        {
                            info,
                            parts: [],
                        }
                    ]
            };
        }

        case "message.remove": {
            return {
                ...state,

                messages: state.messages.filter(
                    (message) => 
                        message.info.id !== event.data.MessageID
                ),
            };
        }

        case "message.part.update": {
            const part = structuredClone(event.data.Part) as MessageV2.Part;

            return {
                ...state,

                messages: state.messages.map((message) => {
                    if (message.info.id !== part.messageID) {
                        return message;
                    }

                    const exists = message.parts.some(
                        (current) => current.id == part.id
                    )

                    return {
                        ...message,

                        parts: exists
                            ? message.parts.map((current) => 
                                current.id === part.id
                                    ? part
                                    : current,
                            )
                            : [
                                ...message.parts,
                                part
                            ],
                    };
                }),
            };
        }

        case "message.part.delta": {
            const {
                MessageID,
                PartID,
                Field,
                Delta
            } = event.data;

            if (Field !== "text") {
                return state;
            }

            return {
                ...state,

                messages: state.messages.map((message) => {
                    if (message.info.id !== MessageID) {
                        return message;
                    }

                    return {
                        ...message,

                        parts: message.parts.map((part) => {
                            if (
                                part.id !== PartID ||
                                (
                                    part.type !== "text" &&
                                    part.type !== "reasoning"
                                )
                            ) {
                                return part;
                            }

                            return {
                                ...part,
                                text: part.text + Delta
                            };
                        }),
                    };
                }),
            };
        }

        case "message.part.remove":
            return {
                ...state,

                messages: state.messages.map((message) => 
                    message.info.id === event.data.MessageID
                        ? {
                            ...message,

                            parts: message.parts.filter(
                                (part) => part.id !== event.data.PartID,
                            )
                        }
                        : message,
                )
            };

        default:
            return state;
    }
}
