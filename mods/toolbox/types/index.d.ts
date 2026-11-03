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

/** A mod listed in the panel: what it published, and whether it is on. */
export type ToolboxMod = {
  id: string
  name: string
  command: string
  description: string
  isOn: boolean
}

declare module 'claude-code' {
  interface PluginState {
    toolbox: {
      /** Whether the toolbox panel above the prompt is open. */
      toolboxOpen: boolean
      toolboxInfo: ToolboxInfo
      advisorInfo: AdvisorInfo
      /** How full the context window is, 0 to 100; null before a measurement. */
      contextPercent: number | null
      /** The installed mods that published an on/off, as last looked at. */
      mods: ToolboxMod[]
    }
  }
}
