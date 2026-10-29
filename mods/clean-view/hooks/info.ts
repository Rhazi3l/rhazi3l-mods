// Clean View's tools and command, registered at session start.

import type { CommandSpec, ToolSpec } from 'claude-code'

export const TOOLS: readonly ToolSpec[] = [
  {
    name: 'plan_steps',
    description:
      'Lay out every step of the job up front so the person can follow along: 2 to 8 short plain-English step names in order, each under 40 characters and starting with a verb. The first step starts right away.',
    inputSchema: {
      type: 'object',
      properties: {
        steps: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 8 },
      },
      required: ['steps'],
    },
    isDeferred: false,
  },
  {
    name: 'report_progress',
    description:
      'Report progress on the current step of the plan: its name and a percent from 0 to 100. Call it as real progress happens and with 100 the moment a step finishes; the next step then starts by itself.',
    inputSchema: {
      type: 'object',
      properties: {
        task: { type: 'string' },
        percent: { type: 'number', minimum: 0, maximum: 100 },
      },
      required: ['task', 'percent'],
    },
    isDeferred: false,
  },
]

export const COMMANDS: readonly CommandSpec[] = [
  {
    name: 'view',
    description: 'Clean View: Details for everything Claude did, the colour legend, or on and off',
    argumentHint: '[details|colours|on|off]',
    immediate: true,
  },
]
