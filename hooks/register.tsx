import type { Register } from 'claude-code'

import { registerCleanView } from './clean-view/clean-view'
import { registerCore } from './core'

export const register: Register = on => {
  registerCore(on)
  registerCleanView(on)
}
