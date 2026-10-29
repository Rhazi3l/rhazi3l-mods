// Plain words and figures for the band. They match ~/.claude/statusline.sh (statusline/statusline.sh
// in the repository): when you change a rule here, change it there.

import { PASTEL } from './palette'

/**
 * How long the prompt cache keeps an entry after its last use. Claude Code asks for the one-hour
 * cache on a subscription and the five-minute one on pay-as-you-go keys, and does not say which a
 * request got, so the band assumes one hour (as the status line does).
 */
export const CACHE_TTL_MS = 60 * 60 * 1000

/** `claude_pro` → `Pro`, `claude_enterprise` → `Enterprise`; the plan as the login record names it, or null. */
export function planName(type: unknown): string | null {
  if (typeof type !== 'string') return null
  const words = type.replace(/^claude_/, '').split('_').filter(word => word !== '')
  return words.length === 0 ? null : words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

/** Time left as `3d 4h`, `2h 10m` or `45m`. */
export function untilTime(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / 60_000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  return `${minutes}m`
}

/** `850`, `174k`, `1.2M`. */
export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${Math.floor(tokens / 1_000_000)}.${Math.floor((tokens % 1_000_000) / 100_000)}M`
  if (tokens >= 1000) return `${Math.floor(tokens / 1000)}k`
  return String(Math.round(tokens))
}

/** The colour of a usage figure: the accent, amber from 80%, red from 95%. */
export function levelColor(percent: number): string {
  if (percent >= 95) return PASTEL.error
  if (percent >= 80) return PASTEL.stuck
  return PASTEL.working
}

/** Lit and unlit cells of a 10-cell bar; any use shows at least one cell. */
export function barCells(percent: number): { lit: string; unlit: string } {
  const pct = Math.min(100, Math.floor(percent))
  let cells = Math.floor((pct * 10 + 50) / 100)
  if (pct > 0 && cells === 0) cells = 1
  return { lit: '▰'.repeat(cells), unlit: '▱'.repeat(10 - cells) }
}

/** Milliseconds of warm cache left: the time since the last main-thread response against the assumed lifetime. */
export function cacheLeftMs(lastAt: number | null, now: number): number {
  return lastAt === null ? 0 : Math.max(0, lastAt + CACHE_TTL_MS - now)
}
