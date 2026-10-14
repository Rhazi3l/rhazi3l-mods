// Plain-language helpers: step-name cleaning, the one-line action summaries,
// API error sentences and time formatting. No engine calls, so tests import
// them directly.

import type { ActionKind } from '../types'

export const MAX_NAME = 40
export const FALLBACK_NAME = 'Working on it'

const CODE_EXTENSIONS =
  'ts|tsx|js|jsx|mjs|cjs|json|jsonc|py|rb|go|rs|java|kt|c|h|cpp|hpp|cs|sh|bash|zsh|fish|lua|toml|yaml|yml|md|html|css|scss|sql|php|swift|vue|svelte|ini|conf|cfg|env|lock|xml|qml|ipynb'
const FILE_NAME = new RegExp(`^[\\w.@-]+\\.(${CODE_EXTENSIONS})[.,;:!?)]*$`, 'i')

/** Trims to `max` characters at a word boundary, adding "…" when cut. */
export function trimToWidth(text: string, max: number): string {
  if (text.length <= max) return text
  if (max <= 1) return '…'
  const head = text.slice(0, max - 1)
  const space = head.lastIndexOf(' ')
  const cut = space > max / 3 ? head.slice(0, space) : head
  return `${cut.trimEnd()}…`
}

/**
 * The one cleaner every step and job name passes through: strips backtick
 * code, anything with a slash and code file names, collapses whitespace,
 * capitalises the first letter and keeps it to 40 characters.
 */
export function cleanName(raw: string): string {
  const words = String(raw ?? '')
    .replace(/`[^`]*`?/g, ' ')
    .split(/\s+/)
    .filter(word => word && !word.includes('/') && !word.includes('\\') && !FILE_NAME.test(word))
  const text = words.join(' ').replace(/\s+/g, ' ').trim()
  if (!text) return FALLBACK_NAME
  return trimToWidth(text[0].toUpperCase() + text.slice(1), MAX_NAME)
}

/** "45s", "1m 12s", "1h 3m". */
export function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

export type ApiErrorKind = string | undefined

/** One calm sentence for an API error that ended a turn. */
export function apiErrorSentence(kind: ApiErrorKind, details?: string): string {
  const text = (details ?? '').toLowerCase()
  if (/prompt is too long|context (window|length)|too many tokens|exceeds the context/.test(text)) {
    return 'type /compact and try again'
  }
  if (kind === 'rate_limit' || kind === 'billing_error' || /rate.?limit|usage limit/.test(text)) {
    return 'you hit your usage limit, try again a little later'
  }
  if (kind === 'overloaded' || kind === 'server_error' || /overloaded/.test(text)) {
    return "Claude's servers are busy, try again in a minute"
  }
  if (
    kind === 'authentication_failed' ||
    kind === 'oauth_org_not_allowed' ||
    kind === 'cloud_credential_error' ||
    /unauthori[sz]ed|invalid api key|log ?in|auth/.test(text)
  ) {
    return 'type /login'
  }
  if (/network|econn|enotfound|socket|fetch failed|connection|offline|timed? ?out/.test(text)) {
    return 'the internet connection dropped'
  }
  return 'something went wrong reaching Claude, try again'
}

/** True when a tool's error text says the person refused it at the dialog. */
export function isUserRefusal(text: string | undefined): boolean {
  return /user doesn't want to proceed|rejected by the user|user (denied|declined|rejected)|permission (was )?denied by the user/i.test(
    text ?? '',
  )
}

export type ActionSummary = {
  kind: ActionKind
  icon: string
  label: string
  detail: string
}

/** Tools that feed the checklist itself and never get a line of their own. */
export const CHECKLIST_TOOLS = new Set([
  'ToolSearch',
  'TodoWrite',
  'TaskCreate',
  'TaskUpdate',
  'TaskList',
  'TaskGet',
])

function basename(path: unknown): string {
  const text = String(path ?? '')
  const parts = text.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] ?? text
}

function words(snake: string): string {
  return snake.replace(/[_-]+/g, ' ').trim()
}

function shortUrl(url: unknown): string {
  const text = String(url ?? '')
  const bare = text.replace(/^[a-z]+:\/\//i, '').replace(/[?#].*$/, '').replace(/\/$/, '')
  return trimToWidth(bare, 60)
}

/** The program a shell command runs, plus its subcommand: "git push", "npm install". */
export function commandHead(command: unknown): string {
  const first = String(command ?? '')
    .trim()
    .split(/\s*(?:&&|\|\||;|\|)\s*/)[0]
  const tokens = first.split(/\s+/).filter(token => !/^[A-Z_][A-Z0-9_]*=/.test(token))
  const program = basename(tokens[0] ?? '')
  const sub = tokens[1]
  const hasSub = sub !== undefined && /^[a-z][a-z0-9-]*$/.test(sub)
  return hasSub ? `${program} ${sub}` : program
}

/** Pretty name of an MCP server: "claude_ai_Gmail" → "Gmail". */
export function serverName(server: string): string {
  return words(server.replace(/^claude_ai_/i, '')) || server
}

/**
 * The one-line summary of a tool call for the technical layer, or null for a
 * call that never gets a line (the checklist's own tools).
 */
export function describeAction(tool: string, input: unknown, ownPrefix: string): ActionSummary | null {
  const args = (input ?? {}) as Record<string, unknown>
  if (CHECKLIST_TOOLS.has(tool) || tool.startsWith(ownPrefix)) return null

  switch (tool) {
    case 'Skill':
      return { kind: 'skill', icon: '🧩', label: 'Used a skill', detail: String(args.skill ?? '') }
    case 'WebFetch':
      return { kind: 'website', icon: '🌐', label: 'Read a website', detail: shortUrl(args.url) }
    case 'WebSearch':
      return {
        kind: 'search',
        icon: '🔎',
        label: 'Searched the web',
        detail: `"${trimToWidth(String(args.query ?? ''), 60)}"`,
      }
    case 'Agent':
    case 'Task':
      return {
        kind: 'agent',
        icon: '🤖',
        label: 'Asked a helper agent',
        detail: `${String(args.subagent_type ?? 'general-purpose')}: "${trimToWidth(String(args.description ?? ''), 40)}"`,
      }
    case 'Bash': {
      const head = commandHead(args.command)
      const what = args.description ? trimToWidth(String(args.description), 50) : 'A command'
      return { kind: 'command', icon: '⌨️', label: 'Ran a command', detail: head ? `${what} (${head})` : what }
    }
    case 'Read':
      return { kind: 'file', icon: '📄', label: 'Read a file', detail: basename(args.file_path) }
    case 'Edit':
    case 'NotebookEdit':
      return {
        kind: 'file',
        icon: '✏️',
        label: 'Changed a file',
        detail: basename(args.file_path ?? args.notebook_path),
      }
    case 'Write':
      return { kind: 'file', icon: '✏️', label: 'Wrote a file', detail: basename(args.file_path) }
    case 'Grep':
      return {
        kind: 'file',
        icon: '🔍',
        label: 'Searched inside files',
        detail: `"${trimToWidth(String(args.pattern ?? ''), 40)}"`,
      }
    case 'Glob':
      return { kind: 'file', icon: '🔍', label: 'Looked for files', detail: String(args.pattern ?? '') }
    case 'AskUserQuestion':
      return { kind: 'question', icon: '💬', label: 'Asked you a question', detail: '' }
  }

  const mcp = /^mcp__(.+?)__(.+)$/.exec(tool)
  if (mcp) {
    return {
      kind: 'connector',
      icon: '🔌',
      label: 'Used an app connection',
      detail: `${serverName(mcp[1])} → ${words(mcp[2])}`,
    }
  }
  return { kind: 'tool', icon: '⚙️', label: 'Used a tool', detail: tool }
}
