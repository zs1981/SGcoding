import { Context } from "effect";

import * as Event from "./service.js";
import { Projector } from "./projector.js";

export class Service extends Context.Service<
    Service,
    Event.Interface
>()("sgcoding/Event/Session") {}

export const defaultlayer = Event.makeLayer({
    service: Service,
    projectors: [Projector],
});
