import { Context } from "effect";
import * as LLM from "./service.js";

export class Service extends Context.Service<
    Service,
    LLM.Interface
>()("sgcoding/LLM") {}

export const LLMLayer = LLM.LLMLayer({
    service: Service
})