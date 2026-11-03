// Effort Auto: when it is on, each prompt gets the effort level it needs. A quick model call reads the
// prompt (and Claude's last reply, for context) before the turn's first request and picks a level with
// the four questions below; the mod then puts that level on the turn's requests. The picker itself is
// touched while it runs (turning it off sets Medium): the toolbox shows the real level (it reads it from this mod's switchboard file), and
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
  return `You pick the effort level an AI assistant (Claude) should use for one prompt. Effort sets how much time, reading and checking Claude spends, and how many decisions it makes alone. It is not how smart Claude is.

Ask these four questions in this order and stop at the first yes:

1. Will the person go back and forth with Claude on this, or is it a simple task? Then low.
   Examples: brainstorming options, quick rewrites, sorting or tagging items, short summaries, rough drafts or outlines, small tweaks to something already made, simple questions.
2. Would a hidden mistake cost money, a client, trust or a wrong decision? Then high.
   Examples: checking numbers across sources, open-ended analysis with no set path, reviewing a contract for risk, fact-checking, going through long documents, verifying and testing work made at a lower level, building or fixing a skill.
3. Is the person handing off a long, hard and critical job and walking away, with no time to answer questions? All three must be true. Then xhigh.
   Examples: a full research report from a year of calls and tickets, reviewing a 50 page agreement before signing, an investor pitch deck as the best one shot. Answer max only when the prompt asks for the deepest possible work and says it is critical; otherwise xhigh.
4. Everything else is medium: everyday writing, repurposing content, meeting summaries, standard reports in a set format, quick research before a call. If you are not sure, medium.

A task being long does not make it high. Rule-following work stays low or medium.
If the prompt only approves, answers a question, or says to go on with earlier work (yes, go, ok, do it, option 2), answer keep.

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
    const wasOn = isOn
    await saveOn($, args === 'on')
    // Turning it off puts the picker back on Medium. Run after this hook has answered: running a command
    // from inside the command that waits on it would hang the chat.
    if (wasOn && !isOn) {
      $.clock.after(300, async () => {
        try {
          await $.command.run({ command: 'effort', args: 'medium' })
        } catch {
          // The picker stays where it is.
        }
      })
    }
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
