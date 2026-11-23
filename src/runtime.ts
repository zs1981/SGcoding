import { Context, Layer, ManagedRuntime } from "effect";

import * as Database from "./database/service.js";
import * as Event from "./event/interface.js";
import * as Session from "./session/interface.js";
import * as Provider from "./llm/provider.js";
import * as LLM from "./llm/interface.js";

export type RuntimeOptions = {
    providerConfig: string;
    databasePath?: string;
};

export function createRuntime(options: RuntimeOptions) {
    const database = Database.makeLayer(options.databasePath);

    const infrasstructure = Layer.mergeAll(
        Event.EventLayer,
        Provider.ProviderLayer(options.providerConfig),
    ).pipe(
        Layer.provideMerge(database),
    );

    const services = Layer.mergeAll(
        Session.SessionLayer,
        Session.StoreLayer,
        LLM.LLMLayer,
    ).pipe(
        Layer.provideMerge(infrasstructure),
    );

    const application = Session.PromptLayer.pipe(Layer.provideMerge(services));

    return ManagedRuntime.make(application);
}