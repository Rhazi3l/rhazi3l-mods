/** One usage window the last response reported, as `$.session.usage()` has it. */
export type UsageWindow = {
  /** `five_hour`, `seven_day`, or a gateway's `spend_limit`. */
  kind: string
  /** How much of the window is used, 0 to 100. */
  percentUsed: number
  /** When the window resets, ISO 8601. */
  resetsAt?: string
}

export type DeskbarUsage = {
  /** The context window's fill, 0 to 100; null before a response of the live window. */
  contextPercent: number | null
  windows: UsageWindow[]
}

export type DeskbarChat = {
  model: string
  effort: string | null
  /** When the main thread last got a response (epoch ms); null if none is known for this chat. */
  lastAt: number | null
  /** Tokens the next request re-sends: the last response's input, cache and output tokens. */
  contextTokens: number
  /** What a new chat starts with: the first response's prompt. Null if unknown. */
  freshTokens: number | null
  /** The plan the login record names (`Pro`, `Max`, `Enterprise`), or null when it can't be read. */
  plan: string | null
}

declare module 'claude-code' {
  interface PluginState {
    deskbar: {
      /** Whether the band shows. The toolbox may read it; only Deskbar writes it. */
      isOn: boolean
      usage: DeskbarUsage
      chat: DeskbarChat
      /** Counts up each minute so the cache time redraws. */
      tick: number
    }
  }
}
