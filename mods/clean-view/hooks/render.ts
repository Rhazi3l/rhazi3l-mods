// The input a `ui.render` hook gets for one component, for the drawing functions that hooks hand it to.

import type { Frozen, RenderComponent, RenderInput } from 'claude-code'

export type RenderEvent<C extends RenderComponent> = Frozen<Extract<RenderInput, { component: C }>>
