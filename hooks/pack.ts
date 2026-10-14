// Shared pieces of the mod pack: what a mod declares, and the two values the
// pack keeps for every mod (whether it is on, and its small settings).

import type { CommandSpec, ToolSpec } from 'claude-code'

export type ModInfo = {
  /** Stable id: the key in `enabledMods`, and the prefix of its settings. */
  id: string
  /** What the toolbox's Mods button and /mods say. */
  name: string
  /** One line for /mods. */
  description: string
  /** Whether the mod starts on before the person has chosen. */
  isOnByDefault: boolean
  /** Tools the model can call, registered once at session start. */
  tools?: readonly ToolSpec[]
  /** Slash commands, registered once at session start; each mod answers its own. */
  commands?: readonly CommandSpec[]
}

/** `$.store` keys the pack saves `enabledMods` and `modSettings` under. Each file
 * that reads them declares its own atom for them: the state scan reads atoms
 * written in the file that uses them. */
export const STORE_ENABLED = 'enabledMods'
export const STORE_SETTINGS = 'modSettings'

export function onlyValues<T>(saved: unknown, isValue: (value: unknown) => value is T): Record<string, T> {
  if (!saved || typeof saved !== 'object') return {}
  return Object.fromEntries(Object.entries(saved as Record<string, unknown>).filter(([, value]) => isValue(value))) as Record<
    string,
    T
  >
}
