import { Schema } from "effect";

export const NonNegativeInt = Schema.Int.check(
    Schema.isGreaterThanOrEqualTo(0),
);

export const withStatics = <S extends object, M extends Record<string, unknown>>( methods: (schema: S) => M ) =>
    (schema: S): S & M => Object.assign(schema, methods(schema));