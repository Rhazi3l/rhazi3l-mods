// Plain-language helpers: step-name cleaning, the one-line action summaries,
// API error sentences and time formatting. No engine calls, so tests import
// them directly.

export const MAX_NAME = 40
const FALLBACK_NAME = 'Working on it'

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
  return trimToWidth(text.charAt(0).toUpperCase() + text.slice(1), MAX_NAME)
}

/** "45s", "1m 12s", "1h 3m". */
export function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

/** One calm sentence for an API error that ended a turn. */
export function apiErrorSentence(kind: string | undefined, details?: string): string {
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

type ActionSummary = {
  icon: string
  label: string
  detail: string
}

/** Tools that feed the checklist itself and never get a line of their own. */
const CHECKLIST_TOOLS = new Set([
  'ToolSearch',
  'TodoWrite',
  'TaskCreate',
  'TaskUpdate',
  'TaskList',
  'TaskGet',
  // The desktop app's own plan tools stand in for the to-do list.
  'mcp__ccd_turn__update_plan',
  'mcp__ccd_turn__wrap_up',
  // A helper agent's own hand-back call: plumbing, not work.
  'SubagentHandback',
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

/** Pretty name of an MCP server: "claude_ai_Gmail" → "Gmail". */
function serverName(server: string): string {
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
      return { icon: '🧩', label: 'Used a skill', detail: String(args.skill ?? '') }
    case 'WebFetch':
      return { icon: '🌐', label: 'Read a website', detail: shortUrl(args.url) }
    case 'WebSearch':
      return {
        icon: '🔎',
        label: 'Searched the web',
        detail: `"${trimToWidth(String(args.query ?? ''), 60)}"`,
      }
    case 'Agent':
    case 'Task':
      return {
        icon: '🤖',
        label: 'Asked a helper agent',
        detail: `${String(args.subagent_type ?? 'general-purpose')}: "${trimToWidth(String(args.description ?? ''), 40)}"`,
      }
    case 'Bash': {
      const what = args.description ? trimToWidth(String(args.description), 50) : 'A command'
      return { icon: '⌨️', label: 'Ran a command', detail: what }
    }
    case 'Read':
      return { icon: '📄', label: 'Read a file', detail: basename(args.file_path) }
    case 'Edit':
    case 'NotebookEdit':
      return {
        icon: '✏️',
        label: 'Changed a file',
        detail: basename(args.file_path ?? args.notebook_path),
      }
    case 'Write':
      return { icon: '✏️', label: 'Wrote a file', detail: basename(args.file_path) }
    case 'Grep':
      return {
        icon: '🔍',
        label: 'Searched inside files',
        detail: `"${trimToWidth(String(args.pattern ?? ''), 40)}"`,
      }
    case 'Glob':
      return { icon: '🔍', label: 'Looked for files', detail: String(args.pattern ?? '') }
    case 'AskUserQuestion':
      return { icon: '💬', label: 'Asked you a question', detail: '' }
    case 'Artifact': {
      const action = String(args.action ?? 'publish')
      const labels: Record<string, string> = {
        publish: args.asset ? 'Uploaded to an artifact' : 'Published an artifact',
        read: 'Read an artifact',
        list: 'Listed your artifacts',
        delete: 'Deleted an artifact',
        open: 'Opened an artifact',
        pin: 'Pinned an artifact',
        unpin: 'Unpinned an artifact',
        quickstart: 'Looked up artifact types',
      }
      return { icon: '📎', label: labels[action] ?? 'Used artifacts', detail: shortUrl(args.url ?? args.file_path) }
    }
    case 'ArtifactData':
      return { icon: '📎', label: "Used an artifact's data", detail: `${String(args.action ?? '')} ${String(args.collection ?? '')}`.trim() }
    case 'ArtifactComments':
      return { icon: '📎', label: "Used an artifact's comments", detail: String(args.action ?? '') }
  }

  const [, server, name] = /^mcp__(.+?)__(.+)$/.exec(tool) ?? []
  if (server && name) {
    return {
      icon: '🔌',
      label: 'Used an app connection',
      detail: `${serverName(server)} → ${words(name)}`,
    }
  }
  return { icon: '⚙️', label: 'Used a tool', detail: spaced(tool) }
}

/** A CamelCase tool name in words: "ArtifactData" → "Artifact data". */
function spaced(name: string): string {
  const spacedOut = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  return spacedOut.charAt(0) + spacedOut.slice(1).toLowerCase()
}

/** Collapses whitespace and cuts to `max` characters, for the Details pane. */
function oneLine(text: unknown, max: number): string {
  const flat = String(text ?? '').replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}

/**
 * Everything worth seeing about a call for the Details pane: the whole
 * command, path, address or query. '' when the one-line summary says it all.
 */
export function describeFull(tool: string, input: unknown): string {
  const args = (input ?? {}) as Record<string, unknown>
  switch (tool) {
    case 'Bash':
      return oneLine(args.command, 400)
    case 'Read':
    case 'Write':
    case 'Edit':
      return String(args.file_path ?? '')
    case 'NotebookEdit':
      return String(args.notebook_path ?? '')
    case 'Grep':
      return oneLine(`${String(args.pattern ?? '')}${args.path ? ` in ${String(args.path)}` : ''}${args.glob ? ` (${String(args.glob)})` : ''}`, 300)
    case 'Glob':
      return oneLine(`${String(args.pattern ?? '')}${args.path ? ` in ${String(args.path)}` : ''}`, 300)
    case 'WebFetch':
      return String(args.url ?? '')
    case 'WebSearch':
      return oneLine(args.query, 300)
    case 'Agent':
    case 'Task':
      return oneLine(args.prompt, 300)
    case 'Skill':
      return oneLine(args.args, 300)
    case 'Artifact':
      return String(args.url ?? args.file_path ?? '')
  }
  if (tool.startsWith('mcp__')) return tool
  return ''
}

/** A tool's answer kept for the Details pane: the head of it, with a note of what was cut. */
const OUTPUT_MAX = 4000
/** The tags Claude Code wraps around a refused call's reason, which are not for the person to read. */
const stripWrapper = (text: unknown) => String(text ?? '').replace(/<\/?tool_use_error>/g, '')
export function clipOutput(text: unknown, max = OUTPUT_MAX): string {
  const whole = stripWrapper(text).replace(/\s+$/, '')
  return whole.length <= max ? whole : `${whole.slice(0, max)}\n… ${whole.length - max} more characters`
}

/** The first line of an error, for a failed action. */
export function firstLine(text: unknown, max = 160): string {
  const line = stripWrapper(text).split('\n').find(part => part.trim() !== '') ?? ''
  return oneLine(line, max)
}

/** What Claude is asking: the last paragraph of its answer, in plain text, cut to its last 240 characters. */
export function extractQuestion(answer: string): string {
  const last = (answer.trim().split(/\n\s*\n/).pop() ?? '').replace(/[*_`#>]+/g, '').replace(/\s+/g, ' ').trim()
  return last.length > 240 ? `…${last.slice(-239)}` : last
}

const YES_NO_START = /^(do|does|did|should|shall|can|could|would|will|is|are|want|ok|okay|may)\b|\b(want me to|shall i|should i|ok to|okay to|would you like me to)\b/i

/** Words that ask the person to pick one of several things. */
const ASKS_TO_CHOOSE = /\b(which|choose|pick|prefer|select|option|number|one of|go with)\b/i

/** The last sentence of the question that ends in a question mark. */
function lastQuestion(question: string): string {
  const sentences = question.match(/[^.!?]*\?/g) ?? []
  return (sentences[sentences.length - 1] ?? question).trim()
}

/**
 * One-press replies for the question Claude ended with. A yes or no question gets Yes and
 * No, whatever else the answer lists. Otherwise a question that asks to choose gets the
 * numbered options the answer lists ("1.", "2)"). A numbered list the question does not
 * ask about (steps, findings, things to drop) gets nothing. Empty when neither fits.
 */
export function quickReplies(answer: string): { label: string; text: string }[] {
  const question = extractQuestion(answer).replace(/^…/, '')
  if (YES_NO_START.test(lastQuestion(question))) {
    return [
      { label: 'Yes', text: 'Yes' },
      { label: 'No', text: 'No' },
    ]
  }
  const numbers = [...answer.matchAll(/^\s*(\d{1,2})[.)]\s+\S/gm)].map(match => Number(match[1]))
  const options: number[] = []
  for (const n of numbers) if (n === options.length + 1) options.push(n)
  if (options.length >= 2 && options.length <= 5 && ASKS_TO_CHOOSE.test(question)) {
    return options.map(n => ({ label: `Option ${n}`, text: `Option ${n}` }))
  }
  return []
}
