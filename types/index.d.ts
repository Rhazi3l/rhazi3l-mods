/** The view the person picked for Clean View: Simple hides tool rows, Guided shows one line each. */
export type CleanViewStyle = 'simple' | 'guided'

/** The view in force: the picked style, or `full` while Clean View is switched off. */
export type ViewMode = CleanViewStyle | 'full'

export type TaskStatus = 'done' | 'active' | 'upcoming'

export type ChecklistTask = {
  id: string
  name: string
  status: TaskStatus
  percent: number
  hasReported: boolean
}

export type ChecklistPhase = 'idle' | 'working' | 'needsYou' | 'stuck' | 'stopped' | 'done'

export type ActionKind =
  | 'skill'
  | 'website'
  | 'search'
  | 'connector'
  | 'agent'
  | 'command'
  | 'file'
  | 'question'
  | 'tool'

/** One thing Claude did behind the scenes, as the technical layer shows it. */
export type ChecklistAction = {
  id: string
  kind: ActionKind
  icon: string
  label: string
  detail: string
  isFailed: boolean
}

export type Checklist = {
  title: string
  phase: ChecklistPhase
  tasks: ChecklistTask[]
  needsYouReason: string | null
  stuckReason: string | null
  startedAt: number | null
  finishedAt: number | null
  isCollapsed: boolean
  /** True once Claude has laid out a plan (plan_steps, TodoWrite or TaskCreate). */
  hasRealPlan: boolean
  /** Increases with every new job, so late answers for an old job are ignored. */
  jobId: number
  /** The most recent actions, newest last. */
  actions: ChecklistAction[]
}

declare module 'claude-code' {
  interface PluginState {
    'rhazi3l-mods': {
      /** Which mods of the pack are on, by mod id; a missing id uses the mod's default. */
      enabledMods: Record<string, boolean>
      /** Each mod's small settings, keyed `<mod id>:<name>` (Clean View: `clean-view:style`). */
      modSettings: Record<string, string>
      checklist: Checklist
      tick: number
    }
  }
}
