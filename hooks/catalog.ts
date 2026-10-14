// Every mod in the pack. To add one: write its folder under hooks/, add its
// info here, and call its register function from register.tsx.

import { CLEAN_VIEW } from './clean-view/info'
import type { ModInfo } from './pack'

export const MODS: readonly ModInfo[] = [CLEAN_VIEW]

export function isModOn(enabled: Readonly<Record<string, boolean>>, id: string): boolean {
  const chosen = enabled[id]
  if (chosen !== undefined) return chosen
  return MODS.find(mod => mod.id === id)?.isOnByDefault ?? false
}
