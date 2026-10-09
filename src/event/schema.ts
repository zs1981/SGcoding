import { Schema } from "effect";
import { withStatics } from "../util/schema.js";
import { Identifier } from "../util/identifier.js";

export const EventID = Schema.String.check(
    Schema.isStartsWith("evt"),
).pipe(
    Schema.brand("EventID"),
    withStatics((schema) => ({
        ascending: (id?: string) =>
            schema.make(
                id ?? "evt_" + Identifier.ascending(),
            )
    })),
);

export type EventID = Schema.Schema.Type<typeof EventID>;