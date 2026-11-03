// Effort Auto: when it is on, each prompt gets the effort level it needs. A quick model call reads the
// prompt (and Claude's last reply, for context) before the turn's first request and picks a level with
// the four questions below; the mod then puts that level on the turn's requests. The picker itself is
// touched: the toolbox shows the real level (it reads it from this mod's switchboard file), and
// moving the picker by hand makes the mod let go until the next prompt it has to judge.
//
// Based on Ben AI's Effort Optimizer, cut down to on and off (always auto) and listed in the toolbox.

import type { EngineInterface, Register } from 'claude-code'

import type { Level } from '../types'
import { publishMod } from './registry'
import type { ModEntry } from './registry'

const ENTRY: ModEntry = {
  id: 'effort-auto',
  name: 'Auto Effort',
  command: 'effort-auto',
  description: 'Reads each prompt and sets the effort level it needs',
}

const STORE_ON = 'isOn'

const LEVELS: readonly Level[] = ['low', 'medium', 'high', 'xhigh', 'max']
const NAMES: Record<Level, string> = { low: 'Low', medium: 'Medium', high: 'High', xhigh: 'Extra high', max: 'Max' }

// Module variables start over on a reload; the saved on/off comes back from the store.
let isOn = true
/** The level the mod holds for the chat, and the picker level it saw when it took over. */
let held: { level: Level; base: string } | null = null
/** The prompt waiting for its pick at the turn's first request. */
let waiting: string | null = null

function norm(value: string) {
  const text = value.toLowerCase().replace(/[^a-z]/g, '')
  return text === 'extrahigh' ? 'xhigh' : text
}

function asLevel(value: unknown): Level | null {
  if (typeof value !== 'string') return null
  const text = norm(value)
  return (LEVELS as readonly string[]).includes(text) ? (text as Level) : null
}

function pickPrompt(text: string, lastReply: string, now: string) {
  return `You pick the effort level Claude Code should use for one prompt from a person working in a terminal, mostly on software. Effort is how much work Claude does on the request: how many files it reads, how much it verifies and tests, and how much it decides alone before checking in. It is not how smart Claude is, and it cannot fix a missing piece of context or a wrong approach.

The levels, from Anthropic's own guidance on effort:
- low: quick answers while the person stays in the loop. Brainstorming, sketching, easy or small changes, explaining or reading code, simple questions, looking something up, git and housekeeping.
- medium: the default, for most regular work. Implementing a feature, a normal edit or refactor, writing tests or docs, an ordinary fix, typical questions about the project.
- high: work where verification matters or there are hidden edge cases. Fixing a bug in an existing codebase, reviewing code or a change for risk, security-sensitive code, data or migration work, anything where a quiet mistake is costly, and checking or testing work made at a lower level.
- xhigh: a long, hard job the person hands over and walks away from, where Claude must reproduce, test and check its own work with nobody to ask.
- max: only when the prompt asks for fully autonomous, end-to-end work on a hard problem, such as building and verifying a whole app or hunting for security flaws in critical software.

How to choose:
1. Start from medium. Move down only when the work is clearly quick, small or conversational. Move up only for a reason from the list above.
2. A long or detailed prompt does not make it harder. A short prompt can still need high (a bug with edge cases).
3. xhigh and max are rare. If you are unsure between two levels, pick the lower one.
4. If the prompt only approves, answers a question Claude asked, or says to go on (yes, go, ok, do it, option 2), answer keep.

The chat runs at: ${now || 'unknown'}

Claude's last reply (first 600 characters, for context):
<reply>
${lastReply || '(none, this is the first prompt)'}
</reply>

The new prompt:
<prompt>
${text}
</prompt>

Reply with JSON only: {"level": "low|medium|high|xhigh|max|keep"}`
}

/** The level the reply names, or null for keep and for anything unreadable. */
function parsePick(text: string): Level | null {
  const match = /\{[\s\S]*\}/.exec(text)
  if (!match) return null
  try {
    return asLevel((JSON.parse(match[0]) as { level?: unknown }).level)
  } catch {
    return null
  }
}

async function pick($: EngineInterface, text: string, now: string): Promise<Level | null> {
  const messages = await $.session.messages()
  let lastReply = ''
  for (let i = messages.length - 1; i >= 0 && !lastReply; i -= 1) {
    const message = messages[i]!
    if (message.role === 'assistant' && message.text.trim()) lastReply = message.text.slice(0, 600)
  }
  const answer = await $.model.complete({
    model: 'claude-sonnet-5-5',
    prompt: pickPrompt(text.slice(0, 4000), lastReply, now),
    maxTokens: 60,
    effort: 'low',
    timeoutMs: 20_000,
  })
  return answer.isAnswered ? parsePick(answer.text) : null
}

/** Records the level the mod holds, which the toolbox shows as the real one. */
async function publish($: EngineInterface) {
  await publishMod($, ENTRY, isOn, { effort: held?.level ?? null })
}

async function saveOn($: EngineInterface, value: boolean) {
  isOn = value
  await $.store.set(STORE_ON, value)
  if (!value) {
    held = null
    waiting = null
  }
  await publish($)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const saved = await $.store.get(STORE_ON)
    isOn = typeof saved === 'boolean' ? saved : true
    // Written even when unchanged, so the toolbox lists this mod.
    await publish($)
    try {
      await $.command.register({
        name: 'effort-auto',
        description: 'Turn automatic effort on or off',
        argumentHint: '[on|off]',
        immediate: true,
      })
    } catch {
      // Not bound (a headless host): the mod still follows what it can.
    }
    return next(e)
  })

  on('command.run', { command: 'effort-auto' }, async ($, e) => {
    const args = e.args.trim().toLowerCase()
    if (args !== '' && args !== 'on' && args !== 'off') return { text: 'Use /effort-auto on or /effort-auto off.' }
    if (args === '') {
      return { text: `Auto Effort is ${isOn ? 'on' : 'off'}${held ? `, holding ${NAMES[held.level]}` : ''}.` }
    }
    await saveOn($, args === 'on')
    return { text: `Auto Effort is ${isOn ? 'on' : 'off'}.` }
  })

  on('prompt.submit', async ($, e, next) => {
    const text = e.text.trim()
    if (isOn && text && !text.startsWith('/') && (e.origin.kind === 'composer' || e.origin.kind === 'bridge')) waiting = text
    return next(e)
  }).catch(($, e, next) => next(e))

  // Every main-chat request: pick for a new prompt at the turn's first, then put the held level on it.
  on('turn.step', async function* ($, e, next) {
    if (!isOn || e.agentId !== undefined || typeof e.effort !== 'string') return yield* next(e)
    // The picker moved by hand: the mod lets go of the old level.
    if (held && e.effort !== held.base) {
      held = null
      await publish($)
    }
    if (waiting !== null && e.index === 0) {
      const text = waiting
      waiting = null
      try {
        const now = held?.level ?? e.effort
        const level = await pick($, text, now)
        if (level) {
          held = level === asLevel(e.effort) ? null : { level, base: e.effort }
          await publish($)
          if (held) $.ui.toast(`Effort set to ${NAMES[level]} (was ${NAMES[asLevel(e.effort) ?? 'medium']})`)
        }
      } catch {
        // A failed pick keeps the level as it was.
      }
    }
    if (!held || held.level === asLevel(e.effort)) return yield* next(e)
    return yield* next({ ...e, effort: held.level })
  })
}
