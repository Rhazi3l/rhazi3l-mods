// Plain words for the toolbox: model names and the choices it offers.

/** Model aliases the toolbox offers, as /model takes them, cheapest per token on the left (Haiku, Sonnet, Opus, Fable). */
export const MODELS = ['haiku', 'sonnet', 'opus', 'fable'] as const

/** Effort levels, lowest first, as /effort takes them. */
export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const

const FAMILY = /(opus|sonnet|haiku|fable)(?:[-_ ]?(\d+)(?:[-._](\d+))?)?/i

/** `claude-opus-5-5[1m]` → `Opus 5.5`, `sonnet` → `Sonnet`; anything else as given. */
export function prettyModel(model: string): string {
  const [, family, major, minor] = FAMILY.exec(model) ?? []
  if (!family) return model || 'Model'
  const name = family.charAt(0).toUpperCase() + family.slice(1).toLowerCase()
  if (!major) return name
  return minor ? `${name} ${major}.${minor}` : `${name} ${major}`
}

/** The alias of the family `model` belongs to, or null. */
export function modelAlias(model: string): string | null {
  return FAMILY.exec(model)?.[1]?.toLowerCase() ?? null
}

/** Advisor models the toolbox offers, as /advisor takes them, in the same order; `off` turns it off. */
export const ADVISORS = MODELS

/** `max` → `Max`: the first letter in capitals, to match the model names. */
export function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}
