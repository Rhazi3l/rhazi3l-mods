/** The view in force: `guided` (the checklist and the latest action), or `full` while Clean View is switched off. */
export type ViewMode = 'guided' | 'full'

export type TaskStatus = 'done' | 'active' | 'upcoming'

export type ChecklistTask = {
  id: string
  name: string
  status: TaskStatus
  percent: number
  hasReported: boolean
}

export type ChecklistPhase = 'idle' | 'working' | 'needsYou' | 'stuck' | 'stopped' | 'done'

/** One thing Claude or a helper agent did, for the trail and the Details pane. */
export type ChecklistAction = {
  id: string
  icon: string
  label: string
  detail: string
  isFailed: boolean
  /** The whole thing for the Details pane: the full command, path, address or query. */
  full: string
  /** The checklist step that was active when it ran. */
  step: string
  /** True when a helper agent did it, not Claude itself. */
  isHelper: boolean
  /** The first line of what went wrong, for a failed action. */
  note: string
  /** What the tool answered, as Claude read it, cut at 4,000 characters; empty until it answers. */
  output: string
}

/** What Claude wrote between tool calls: hidden from the transcript, shown in the box and in Details. */
export type ChecklistNote = {
  id: string
  text: string
  /** The checklist step that was active when it was written. */
  step: string
  /** How many of that step's actions came before it, so Details can place it among them. */
  before: number
}

export type Checklist = {
  title: string
  phase: ChecklistPhase
  tasks: ChecklistTask[]
  needsYouReason: string | null
  /** What Claude is asking while it waits for a reply: the end of its answer, in plain text. */
  question: string
  /** One-press replies for that question (numbered options, or Yes and No). */
  replies: { label: string; text: string }[]
  stuckReason: string | null
  startedAt: number | null
  finishedAt: number | null
  isCollapsed: boolean
  /** True once Claude has laid out a plan (TodoWrite or TaskCreate). */
  hasRealPlan: boolean
  /** Increases with every new job, so late answers for an old job are ignored. */
  jobId: number
  /** The job's actions, newest last, up to the last 300. */
  actions: ChecklistAction[]
  /** Claude's notes between tool calls, newest last, up to the last 100. */
  notes: ChecklistNote[]
}

declare module 'claude-code' {
  interface PluginState {
    'clean-view': {
      /** Whether Clean View is on. Other mods (the toolbox) read it; only Clean View writes it. */
      isOn: boolean
      checklist: Checklist
      tick: number
      /** What Claude wrote between tool calls this job; the transcript hides it while Clean View is on. */
      narration: string[]
    }
  }
}
