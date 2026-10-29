/** What the toolbox shows: the model and effort the session runs with. */
export type ToolboxInfo = {
  model: string
  /** The effort the last request used, or the saved setting; null before either is known. */
  effort: string | null
}

export type AdvisorInfo = {
  /** The advisor model from settings (`advisorModel`), or null when none is set. */
  model: string | null
}

declare module 'claude-code' {
  interface PluginState {
    toolbox: {
      /** Whether the toolbox panel above the prompt is open. */
      toolboxOpen: boolean
      toolboxInfo: ToolboxInfo
      advisorInfo: AdvisorInfo
    }
    /**
     * Read only: owned and written by the Clean View mod. Undefined means it
     * isn't installed (or hasn't started), so the toolbox shows no button for it.
     */
    'clean-view': {
      isOn: boolean
    }
    /** Read only, as above: owned and written by the Prompt Upgrade mod. */
    'prompt-upgrade': {
      isOn: boolean
    }
  }
}
