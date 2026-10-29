// What every part of Clean View shares: the empty job, the names of its panes and the texts that say why a
// job is waiting or stuck. The saved values themselves (the atoms) live in register.tsx, the one file the
// engine lets read and write them.

import type { Checklist } from '../types'

export const DEFAULT_TITLE = 'Working on your request'
export const DETAILS_PANE = 'clean-view-details'
export const DETAILS_TITLE = 'What Claude did'

/** Why Claude is waiting, as the box says it after `Waiting for you`; a plain reply needs no reason. */
export const REASON_PERMISSION = 'needs your OK'
export const REASON_QUESTION = 'has a question'
export const REASON_REPLY = ''
export const STUCK_REFUSED = 'you said no to a step'
export const STUCK_FAILING = 'a step keeps failing, trying another way'
export const STUCK_REFUSAL = "Claude couldn't help with that request"

export const EMPTY: Checklist = {
  title: '',
  phase: 'idle',
  tasks: [],
  needsYouReason: null,
  question: '',
  replies: [],
  stuckReason: null,
  startedAt: null,
  finishedAt: null,
  isCollapsed: false,
  hasRealPlan: false,
  jobId: 0,
  actions: [],
  notes: [],
  times: {},
}

export const STORE_ON = 'isOn'
export const STORE_ALERTS = 'alertsOn'
