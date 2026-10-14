/** Where an upgrade stands: nothing yet, the model working, ready to review, or a failure. */
export type UpgradePhase = 'idle' | 'working' | 'review' | 'error'

export type UpgradeFlow = {
  phase: UpgradePhase
  /** The prompt the person typed, kept until they send, copy or cancel. */
  original: string
  /** The rewrite; the person may edit it. */
  upgraded: string
  /** Short phrases saying what the rewrite added. */
  added: string[]
  /** True while the upgrade is open for editing. */
  isEditing: boolean
  /** A plain sentence for the error card. */
  note: string
  /** Increases with every upgrade, so a late model answer for an old one is ignored. */
  runId: number
}

declare module 'claude-code' {
  interface PluginState {
    'prompt-upgrade': {
      /** Whether the Upgrade prompt button shows. Other mods (the toolbox) read it; only Prompt Upgrade writes it. */
      isOn: boolean
      flow: UpgradeFlow
    }
  }
}
