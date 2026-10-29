// Clean View's command, registered at session start.

import type { CommandSpec } from 'claude-code'

export const COMMANDS: readonly CommandSpec[] = [
  {
    name: 'view',
    description: 'Clean View: switch it on or off, or its alerts',
    argumentHint: '[on|off|alerts on|alerts off]',
    immediate: true,
  },
]
