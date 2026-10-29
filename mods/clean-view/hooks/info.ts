// Clean View's command, registered at session start.

import type { CommandSpec } from 'claude-code'

export const COMMANDS: readonly CommandSpec[] = [
  {
    name: 'view',
    description: 'Clean View: Details for everything Claude did, the colour legend, or on and off',
    argumentHint: '[details|colours|on|off]',
    immediate: true,
  },
]
