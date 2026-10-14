/** The view the person picked for Clean View: Simple shows the checklist alone, Guided adds the latest action. */
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
  /** The job's actions, newest last, up to the last 300. */
  actions: ChecklistAction[]
}

/** What the toolbox shows: the model and effort the session runs with. */
export type ToolboxInfo = {
  model: string
  /** The effort the last request used, or the saved setting; null before either is known. */
  effort: string | null
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
      /** True while the Details pane has asked for the engine's own tool rows in the transcript. */
      cleanViewRaw: boolean
      /** Whether the toolbox panel above the prompt is open. */
      toolboxOpen: boolean
      toolboxInfo: ToolboxInfo
    }
  }
}
