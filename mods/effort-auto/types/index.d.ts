export type Level = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

declare module 'claude-code' {
  interface PluginState {
    'effort-auto': {
      /** The level the mod puts on this session's requests, or null while it leaves the picker alone. */
      level: Level | null
    }
  }
}
