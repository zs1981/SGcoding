import { Schema, type Types } from "effect";
import { withStatics } from "../../util/schema.js";
import { Identifier } from "../../util/identifier.js";
import { Database } from "../../database/index.js";


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

export interface Definition {
    readonly type: string;
    readonly dataSchema: Schema.Schema<unknown>;
    readonly aggregateSchema: Schema.Schema<string>;
    readonly persistent: boolean;
}

export function define<const D extends Definition>(input: D): D {
    return Object.freeze(input);
}

export type Data<D extends Definition> = Types.DeepMutable<D["dataSchema"]["Type"]>;

export type AggregateID<D extends Definition> = D["aggregateSchema"]["Type"];

export type Publish<D extends Definition> = 
    D extends Definition // 
        ? {
            readonly aggregateID: AggregateID<D>;
            readonly data: Data<D>;
            readonly type: D["type"];
        }
        : never;

type Sequence<P extends boolean> = 
    P extends true
        ? {readonly seq: number}
        : {}

export type Payload<D extends Definition> = 
    D extends Definition
        ? {
            readonly aggregateID: AggregateID<D>;
            readonly data: Data<D>;
            readonly type: D["type"]
            readonly eventID: EventID,
        } & Sequence<D["persistent"]>
        : never


export type EventTransaction = Parameters<
    Parameters<Database.AppDatabase["transaction"]>[0]
>[0];