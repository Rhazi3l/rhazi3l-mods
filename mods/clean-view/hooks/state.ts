// What every part of Clean View shares: the empty job, the names of its panes and the texts that say why a
// job is waiting or stuck. The saved values themselves (the atoms) live in register.tsx, the one file the
// engine lets read and write them.

import type { Checklist } from '../types'

export const DEFAULT_TITLE = 'Working on your request'
export const DETAILS_PANE = 'clean-view-details'
export const DETAILS_TITLE = 'What Claude did'
export const COLOURS_PANE = 'clean-view-colours'
export const COLOURS_TITLE = 'Frame colours'

export const REASON_PERMISSION = 'Claude needs your OK to continue'
export const REASON_QUESTION = 'Claude has a question for you'
export const REASON_REPLY = 'Claude is waiting for your reply'
export const STUCK_REFUSED = 'you said no to a step, so Claude paused'
export const STUCK_FAILING = 'a step keeps failing, Claude is trying another way'
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
