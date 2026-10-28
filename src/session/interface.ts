import { Context } from "effect";
import * as Session from "./service.js";

export class Service extends Context.Service<
    Service,
    Session.Interface
>()("sgcoding/Session") {};

export const SessionLayer = Session.SessionLayer({
    service: Service
});

