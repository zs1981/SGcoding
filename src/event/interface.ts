import { Context } from "effect";

import * as Event from "./service.js";
import { Projector } from "./projector.js";

export class Service extends Context.Service<
    Service,
    Event.Interface
>()("sgcoding/Event") {}

export const EventLayer = Event.EventLayer({
    service: Service,
    projectors: [Projector],
});
