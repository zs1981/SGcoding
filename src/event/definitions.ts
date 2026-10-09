import type { Schema } from "effect";
import type { EventID } from "./schema.js";

export type DataSchema = Schema.Codec<unknown, unknown, never, never>;

export type AggregateId = Schema.Codec<string, string, never, never>;

export type AggregateSchema = Schema.Codec<string, string, never, never>;

export interface Definition {
    readonly type: string;
    readonly schema: DataSchema;
    readonly aggregate: AggregateSchema;
    readonly persistent: boolean;
};

export function define<const D extends Definition>(input: D): D {
    return Object.freeze(input);
}

export type Data<D extends Definition> = D["schema"]["Type"];

export type EncodedData<D extends Definition> = D["schema"]["Encoded"];

export type AggregateID<D extends Definition> = D["aggregate"]["Type"];

export type Input<D extends Definition> = 
    D extends Definition
        ? {
            readonly aggregateId: AggregateID<D>;
            readonly data: Data<D>;
        }
        : never;


export type Publish<D extends Definition> = 
    D extends Definition
        ? Input<D> & {
            readonly type: D["type"];
        }
        : never;

type Sequence<P extends boolean> = 
    P extends true
        ? {
            readonly seq: number;
        }
        : {
            readonly seq?: never;
        };

export type Payload<D extends Definition = Definition> = 
    D extends Definition
        ? Publish<D> & {
            readonly eventId: EventID;
        } & Sequence<D["persistent"]>
        : never;