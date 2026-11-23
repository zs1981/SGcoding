import { Context } from "effect";
import * as Session from "./session.js";
import * as Store from "./store.js";
import * as Prompt from "./prompt.js";

export class SessionService extends Context.Service<
    SessionService,
    Session.Interface
>()("sgcoding/Session") {};

export const SessionLayer = Session.SessionLayer({
    service: SessionService
});

export class StoreService extends Context.Service<
    StoreService,
    Store.Interface
>()("sgcoding/Store") {};

export const StoreLayer = Store.StoreLayer({
    service: StoreService,
});

export class PromptService extends Context.Service<
    PromptService,
    Prompt.Interface
>()("sgcoding/Prompt") {};

export const PromptLayer = Prompt.PromptLayer({
    service: PromptService,
});


