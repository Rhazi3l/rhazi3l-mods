// Deskbar: the status line's figures as a band above the prompt, for the desktop app, which
// does not draw the status line setting. Plan, context, prompt cache and the 5h and
// weekly usage, in the rules of ~/.claude/statusline.sh (statusline/statusline.sh in the repository).
// It records on every surface and draws only off the terminal, so a chat used in the terminal and
// resumed on the desktop comes up filled in. Colours are the mods' palette.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { DeskbarChat, DeskbarUsage } from '../types'
import { PASTEL } from './palette'
import { barCells, cacheLeftMs, formatTokens, levelColor, planName, untilTime } from './text'

const EMPTY_USAGE: DeskbarUsage = { contextPercent: null, windows: [] }
const EMPTY_CHAT: DeskbarChat = {
  lastAt: null,
  contextTokens: 0,
  freshTokens: null,
  plan: null,
}

const isOnAtom = atom({ plugin: 'deskbar', key: 'isOn' } as const, true)
const usageAtom = atom({ plugin: 'deskbar', key: 'usage' } as const, EMPTY_USAGE)
const chatAtom = atom({ plugin: 'deskbar', key: 'chat' } as const, EMPTY_CHAT)
// Counts up each minute, so the cache time redraws.
const tickAtom = atom({ plugin: 'deskbar', key: 'tick' } as const, 0)

const STORE_ON = 'isOn'
const STORE_RESPONSES = 'lastResponses'
const STORE_KEEP = 20
const USAGE = 'Deskbar shows the plan, context, 5h and weekly usage and prompt cache above the prompt in the desktop app. /deskbar on or /deskbar off.'

/** What is kept per chat so a resumed one knows whether its cache is still held. */
type Stored = Record<string, { at: number; tokens: number; first?: number }>

async function remember($: EngineInterface, sessionId: string, entry: Stored[string]) {
  const held = ((await $.store.get(STORE_RESPONSES)) ?? {}) as Stored
  const kept = Object.entries({ ...held, [sessionId]: entry })
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, STORE_KEEP)
  await $.store.set(STORE_RESPONSES, Object.fromEntries(kept))
}

/** The context fill, usage windows and cost the engine has now. */
async function readUsage($: EngineInterface) {
  try {
    const { context, rateLimits } = await $.session.usage()
    await update($, usageAtom, () => ({
      contextPercent: context.percent ?? null,
      windows: rateLimits.map(({ kind, percentUsed, resetsAt }) => ({ kind, percentUsed, resetsAt })),
    }))
  } catch {
    // No session to read (a headless host): the band fills in when a measurement arrives.
  }
}

/** The plan the person's login record names, read from the same config file the login keeps (`organizationType`). */
async function readPlan($: EngineInterface) {
  try {
    // The config folder if one is set, else the home folder: HOME on Linux and macOS, USERPROFILE on Windows.
    const home = (await $.env.get('CLAUDE_CONFIG_DIR')) ?? (await $.env.get('HOME')) ?? (await $.env.get('USERPROFILE'))
    if (!home) return
    const account = JSON.parse(await $.fs.read(`${home}/.claude.json`)).oauthAccount
    const plan = planName(account?.organizationType)
    await update($, chatAtom, now => ({ ...now, plan }))
  } catch {
    // The file can't be read: the band says Subscription while usage limits show, and nothing before.
  }
}

/** What a new chat starts with, when the first response of this chat came before the mod loaded: the window without its messages. */
async function estimateFresh($: EngineInterface) {
  try {
    const { context } = await $.session.usage({ breakdown: 'summary' })
    const fresh = (context.breakdown?.categories ?? [])
      .filter(row => row.kind === 'used' && !/^messages?$/i.test(row.name))
      .reduce((sum, row) => sum + row.tokens, 0)
    if (fresh > 0) await update($, chatAtom, now => ({ ...now, freshTokens: now.freshTokens ?? fresh }))
  } catch {
    // No breakdown: the cold message shows the resume figure alone.
  }
}

/** A /clear starts the session's values over and fires no session.start, so the on/off the toolbox reads is written again from what was saved. */
async function restoreAfterClear($: EngineInterface) {
  const { value } = await $.state.get({ plugin: 'deskbar', key: 'isOn' } as const)
  if (value !== undefined) return
  const saved = await $.store.get(STORE_ON)
  await update($, isOnAtom, () => (typeof saved === 'boolean' ? saved : true))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const saved = await $.store.get(STORE_ON)
    // Written even when unchanged, so the toolbox can tell Deskbar is installed.
    await update($, isOnAtom, () => (typeof saved === 'boolean' ? saved : true))
    try {
      await $.command.register({
        name: 'deskbar',
        description: 'Show or hide the usage band above the prompt (desktop app)',
        argumentHint: '[on|off]',
        immediate: true,
      })
    } catch {
      // Not bound (a headless host): the band still follows what it can.
    }

    const started = await next(e)
    await readUsage($)
    await readPlan($)
    try {
      // A resumed chat: when it last got a response, and the size its first prompt had.
      const held = ((await $.store.get(STORE_RESPONSES)) ?? {}) as Stored
      const was = held[await $.session.id()]
      if (was) {
        await update($, chatAtom, now => ({
          ...now,
          lastAt: was.at,
          contextTokens: was.tokens,
          freshTokens: was.first ?? now.freshTokens,
        }))
      }
      $.clock.every(60_000, () => void update($, tickAtom, n => n + 1))
    } catch {
      // No session or store (a headless host): the cache starts unknown.
    }
    if ((await read($, chatAtom)).freshTokens === null) await estimateFresh($)
    return started
  })

  on('command.run', { command: 'deskbar' }, async ($, e) => {
    const args = e.args.trim().toLowerCase()
    if (args !== '' && args !== 'on' && args !== 'off') return { text: USAGE }
    const turnsOn = args === '' ? !(await read($, isOnAtom)) : args === 'on'
    await update($, isOnAtom, () => turnsOn)
    await $.store.set(STORE_ON, turnsOn)
    return { text: `Deskbar is ${turnsOn ? 'on' : 'off'}.` }
  })

  // The figures the engine measures: context fill, usage windows and cost.
  on('session.measure', async ($, e, next) => {
    await update($, usageAtom, () => ({
      contextPercent: e.context.percent ?? null,
      windows: e.rateLimits.map(({ kind, percentUsed, resetsAt }) => ({ kind, percentUsed, resetsAt })),
    }))
    return next(e)
  })

  // When the main thread was last answered, and how big its context is.
  on('turn.step', async function* ($, e, next) {
    const response = yield* next(e)
    // Only the main thread warms the main thread's cache; a helper agent's request doesn't.
    if (e.agentId === undefined && response.usage) {
      const { input_tokens, cache_read_input_tokens, cache_creation_input_tokens, output_tokens } = response.usage
      const tokens = input_tokens + cache_read_input_tokens + cache_creation_input_tokens + output_tokens
      const at = await $.clock.now()
      // The first request of a chat carries only the system prompt, tools, memory and the first message.
      const isFirst = e.messageCount <= 2
      const chat = await update($, chatAtom, now => ({
        ...now,
        lastAt: at,
        contextTokens: tokens,
        freshTokens: isFirst ? tokens : now.freshTokens,
      }))
      try {
        await remember($, await $.session.id(), { at, tokens, first: chat.freshTokens ?? undefined })
      } catch {
        // No store (a headless host): a resumed chat will read as unknown.
      }
    }
    return response
  })

  // A /clear starts a chat with an empty cache.
  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      await update($, chatAtom, now => ({ ...EMPTY_CHAT, plan: now.plan }))
      $.clock.after(200, () => void restoreAfterClear($))
    }
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    await restoreAfterClear($)
    return next(e)
  })

  // The band, under whatever other mods draw above the prompt, on the desktop app and the editor extension.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || e.surface === 'terminal' || e.surface === 'mobile') return next(e)
    const below = await next(e)
    if (!(await read($, isOnAtom))) return below

    const { Box, Text } = $.ui.resolve(e)
    const usage = await read($, usageAtom)
    const chat = await read($, chatAtom)
    await read($, tickAtom)
    const now = await $.clock.now()

    const five = usage.windows.find(w => w.kind === 'five_hour')
    const week = usage.windows.find(w => w.kind === 'seven_day')
    // The plan from the login record; before it is known, Subscription once usage limits show.
    const plan = chat.plan ?? (usage.windows.length > 0 ? 'Subscription' : null)
    const leftMs = cacheLeftMs(chat.lastAt, now)
    const isWarm = leftMs > 0

    // Each figure is its own Box, so the desktop app's wider font wraps the row instead of overlapping it.
    const part = (key: string, children: unknown) => (
      <Box key={key} flexShrink={0} marginRight={2}>
        {children as never}
      </Box>
    )
    const bar = (percent: number) => {
      const { lit, unlit } = barCells(percent)
      return (
        <Box key="bar">
          <Text color={levelColor(percent)}>{lit}</Text>
          <Text dimColor>{unlit}</Text>
        </Box>
      )
    }
    const windowPart = (key: string, label: string, w: { percentUsed: number; resetsAt?: string }) =>
      part(key, [
        <Text key="label" dimColor>{`${label} `}</Text>,
        <Text key="pct" bold color={levelColor(w.percentUsed)}>{`${Math.floor(w.percentUsed)}%`}</Text>,
        ...(w.resetsAt ? [<Text key="reset" dimColor>{` ↻ ${untilTime(Date.parse(w.resetsAt) - now)}`}</Text>] : []),
      ])

    return (
      <Box flexDirection="column">
        {below}
        {/* Room above and below, and the checklist frame's left inset, so the band doesn't crowd the frame or the prompt box. */}
        <Box key="deskbar" flexDirection="row" flexWrap="wrap" paddingX="sm" marginTop="xs" marginBottom="xs">
          {plan !== null &&
            part('plan', [
              <Text key="dot" color={PASTEL.done}>{'◆ '}</Text>,
              <Text key="name">{plan}</Text>,
            ])}
          {usage.contextPercent !== null &&
            part('context', [
              <Text key="label" dimColor>{'ctx '}</Text>,
              bar(usage.contextPercent),
              <Text key="pct" bold color={levelColor(usage.contextPercent)}>{` ${Math.floor(usage.contextPercent)}%`}</Text>,
            ])}
          {five && windowPart('five', '5h', five)}
          {week && windowPart('week', 'week', week)}
          {part('cache', [
            <Text key="label" dimColor>{'cache '}</Text>,
            chat.lastAt === null ? (
              <Text key="state" dimColor>{'○ ?'}</Text>
            ) : isWarm ? (
              <Box key="state">
                <Text color={PASTEL.done}>{'● '}</Text>
                <Text>{`warm ${untilTime(leftMs)}`}</Text>
              </Box>
            ) : (
              <Text key="state" dimColor>
                {`○ cold · resume ${formatTokens(chat.contextTokens)} tokens`}
                {chat.freshTokens !== null ? ` · new chat ${formatTokens(chat.freshTokens)}` : ''}
              </Text>
            ),
          ])}
        </Box>
      </Box>
    )
  })
}
