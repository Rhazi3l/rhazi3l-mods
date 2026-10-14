import type { Register } from 'claude-code'

import { registerCleanView } from './clean-view/clean-view'
import { registerModsRow } from './mods-row'

export const register: Register = on => {
  registerModsRow(on)
  registerCleanView(on)
}
