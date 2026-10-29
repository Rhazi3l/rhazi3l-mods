import { describe, expect, mock, test } from 'claude-code/testing'
import type { Engine, MockClock } from 'claude-code/testing'
import type { On } from 'claude-code'

import { barCells, formatTokens, levelColor, planName, untilTime } from '../hooks/text'

const NOW = Date.parse('2026-10-29T10:00:00Z')
const HOUR = 3_600_000
const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } } as const
const BAND = {
  plugin: 'deskbar',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 20,
    bodyColumns: 90,
    scroll: { offset: 0, bodyRows: 19 },
    view: {},
  },
} as const

let clock: MockClock

const RESPONSE = {
  turnId: 't',
  index: 0,
  answer: '',
  toolUses: [],
  stopReason: 'end_turn',
  usage: {
    input_tokens: 1000,
    output_tokens: 500,
    cache_read_input_tokens: 100_000,
    cache_creation_input_tokens: 1500,
    model: 'claude-sonnet-5-5',
  },
} as const

type Windows = { kind: string; percentUsed: number; resetsAt?: string }[]

/** The engine's answers beneath the plugin. */
async function startSession($: Engine, on: On, options: { stored?: Record<string, unknown>; windows?: Windows; plan?: string; home?: string } = {}) {
  clock = mock.clock(on, { now: NOW })
  mock.store(on, options.stored)
  mock.env(on, options.home === undefined ? { HOME: '/home/test' } : { USERPROFILE: options.home })
  const account = options.plan ? { oauthAccount: { organizationType: options.plan } } : {}
  on('fs.read', (_$, e) => (e.path === '/home/test/.claude.json' ? ({ value: JSON.stringify(account) } as never) : ({ deny: 'no such file' } as never)))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.id', () => ({ value: 'chat-1' }) as never)
  on('session.usage', () =>
    ({
      value: {
        startedAt: 0,
        rateLimits: options.windows ?? [],
        context: {
          window: 1_000_000,
          percent: 30,
          breakdown: {
            categories: [
              { name: 'System prompt', tokens: 3000, kind: 'used' },
              { name: 'Messages', tokens: 90_000, kind: 'used' },
              { name: 'Free space', tokens: 900_000, kind: 'free' },
            ],
          },
        },
      },
    }) as never,
  )
  on('session.end', (_$, e) => ({ sessionId: e.sessionId }))
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  on('turn.step', async function* () {
    return RESPONSE as never
  })
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true })
}

async function respond($: Engine, extra: { agentId?: string; messageCount?: number } = {}) {
  const stream = $.turn.step({ turnId: 't', index: 0, model: 'claude-sonnet-5-5', messageCount: 5, ...extra })
  for await (const chunk of stream) void chunk
}

const FIVE = { kind: 'five_hour', percentUsed: 12.4, resetsAt: new Date(NOW + 2 * HOUR + 10 * 60_000).toISOString() }
const WEEK = { kind: 'seven_day', percentUsed: 85, resetsAt: new Date(NOW + 3 * 24 * HOUR + 4 * HOUR).toISOString() }

describe('deskbar words', () => {
  test('figures read as the status line writes them', async () => {
    expect(untilTime(2 * HOUR + 10 * 60_000)).toBe('2h 10m')
    expect(untilTime(3 * 24 * HOUR + 4 * HOUR)).toBe('3d 4h')
    expect(untilTime(45 * 60_000)).toBe('45m')
    expect(untilTime(-5)).toBe('0m')
    expect(formatTokens(850)).toBe('850')
    expect(formatTokens(174_404)).toBe('174k')
    expect(formatTokens(1_250_000)).toBe('1.2M')
    expect(planName('claude_pro')).toBe('Pro')
    expect(planName('claude_enterprise')).toBe('Enterprise')
    expect(planName('claude_max')).toBe('Max')
    expect(planName(undefined)).toBeNull()
    expect(barCells(30)).toEqual({ lit: '▰▰▰', unlit: '▱▱▱▱▱▱▱' })
    expect(barCells(1).lit).toBe('▰')
    expect(barCells(120).unlit).toBe('')
    expect(levelColor(79)).not.toBe(levelColor(80))
    expect(levelColor(94)).not.toBe(levelColor(95))
  })
})

describe('deskbar', () => {
  test('the terminal draws nothing; the desktop draws every figure', async ($, on) => {
    await startSession($, on, { windows: [FIVE, WEEK], plan: 'claude_pro' })
    const terminal = await $.ui.mount({ ...BAND, surface: 'terminal' })
    expect(await terminal.find({ key: 'deskbar' })).toBeUndefined()
    await terminal.unmount()

    const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
    expect(await band.find({ key: 'deskbar' })).toMatchObject({ props: { flexWrap: 'wrap' } })
    expect(await band.find({ type: 'Text', text: 'Pro' })).toBeDefined()
    // The desktop app shows the model and effort itself, so the band leaves them out.
    expect(await band.find({ type: 'Text', text: 'Sonnet 5.5' })).toBeUndefined()
    expect(await band.find({ key: 'model' })).toBeUndefined()
    expect(await band.find({ key: 'effort' })).toBeUndefined()
    expect(await band.find({ type: 'Text', text: ' 30%' })).toBeDefined()
    expect(await band.find({ type: 'Text', text: '12%' })).toBeDefined()
    expect(await band.find({ type: 'Text', text: ' ↻ 2h 10m' })).toBeDefined()
    expect(await band.find({ type: 'Text', text: '85%' })).toMatchObject({ props: { color: levelColor(85) } })
    expect(await band.find({ type: 'Text', text: ' ↻ 3d 4h' })).toBeDefined()
    await band.unmount()
  })

  test('the cache is the last figure on the row, after the weekly usage', async ($, on) => {
    await startSession($, on, { windows: [FIVE, WEEK], plan: 'claude_pro' })
    const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
    const tree = JSON.stringify(await band.find({ key: 'deskbar' }))
    const at = ['"plan"', '"context"', '"five"', '"week"', '"cache"'].map(key => tree.indexOf(key))
    expect(at.every(i => i > -1)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    await band.unmount()
  })

  test('a measurement redraws the usage windows', async ($, on) => {
    await startSession($, on, { windows: [FIVE] })
    await $.session.measure({
      context: { window: 1_000_000, percent: 96 },
      rateLimits: [{ kind: 'five_hour', percentUsed: 40 }],
      changed: ['context', 'rateLimits'],
    })
    const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
    expect(await band.find({ type: 'Text', text: '40%' })).toBeDefined()
    expect(await band.find({ type: 'Text', text: ' 96%' })).toMatchObject({ props: { color: levelColor(96) } })
    await band.unmount()
  })

  test('the plan is the login record\'s, Subscription while it can\'t be read, and nothing without usage limits', async ($, on) => {
    await startSession($, on, { windows: [FIVE], plan: 'claude_enterprise' })
    const enterprise = await $.ui.mount({ ...BAND, surface: 'desktop' })
    expect(await enterprise.find({ type: 'Text', text: 'Enterprise' })).toBeDefined()
    expect(await enterprise.find({ type: 'Text', text: 'API' })).toBeUndefined()
    await enterprise.unmount()
  })

  test('with no readable plan, Subscription shows once usage limits do', async ($, on) => {
    await startSession($, on, { windows: [FIVE] })
    const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
    expect(await band.find({ type: 'Text', text: 'Subscription' })).toBeDefined()
    await band.unmount()
  })

  test('a plan with no usage windows (an Enterprise seat may report none) shows the plan and no blank figures', async ($, on) => {
    await startSession($, on, { plan: 'claude_enterprise' })
    const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
    expect(await band.find({ type: 'Text', text: 'Enterprise' })).toBeDefined()
    expect(await band.find({ key: 'five' })).toBeUndefined()
    expect(await band.find({ key: 'week' })).toBeUndefined()
    await band.unmount()
  })

  test('on Windows the plan is read from the USERPROFILE folder', async ($, on) => {
    await startSession($, on, { plan: 'claude_max', home: '/home/test' })
    const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
    expect(await band.find({ type: 'Text', text: 'Max' })).toBeDefined()
    await band.unmount()
  })

  test('with neither a plan nor usage limits there is no plan label', async ($, on) => {
    await startSession($, on)
    const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
    expect(await band.find({ type: 'Text', text: /Subscription|API/ })).toBeUndefined()
    await band.unmount()
  })

  test('the cache is unknown, then warm for an hour after a main-thread response, then cold', async ($, on) => {
    await startSession($, on)
    const first = await $.ui.mount({ ...BAND, surface: 'desktop' })
    expect(await first.find({ type: 'Text', text: '○ ?' })).toBeDefined()
    await first.unmount()

    await respond($)
    await clock.advance(41 * 60_000)
    const warm = await $.ui.mount({ ...BAND, surface: 'desktop' })
    expect(await warm.find({ type: 'Text', text: 'warm 19m' })).toBeDefined()
    await warm.unmount()

    await clock.advance(21 * 60_000)
    const cold = await $.ui.mount({ ...BAND, surface: 'desktop' })
    // 103,000 tokens to resume; the chat's first request (messageCount 5 here) is not a first request, so the new-chat
    // figure is the estimate from the breakdown: 3,000 tokens that aren't messages.
    expect(await cold.find({ type: 'Text', text: /cold · resume 103k tokens · new chat 3\.0k|cold · resume 103k tokens · new chat 3k/ })).toBeDefined()
    await cold.unmount()
  })

  test('a chat\'s first request sets the new-chat size, kept for a resume', async ($, on) => {
    await startSession($, on)
    await respond($, { messageCount: 1 })
    await clock.advance(2 * HOUR)
    const cold = await $.ui.mount({ ...BAND, surface: 'desktop' })
    expect(await cold.find({ type: 'Text', text: '○ cold · resume 103k tokens · new chat 103k' })).toBeDefined()
    await cold.unmount()
  })

  test('a helper agent does not warm the main cache', async ($, on) => {
    await startSession($, on)
    await respond($, { agentId: 'helper' })
    const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
    expect(await band.find({ type: 'Text', text: '○ ?' })).toBeDefined()
    await band.unmount()
  })

  test('a resumed chat reads its stored response time and first prompt', async ($, on) => {
    await startSession($, on, { stored: { lastResponses: { 'chat-1': { at: NOW - 10 * 60_000, tokens: 200_000, first: 47_000 } } } })
    const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
    expect(await band.find({ type: 'Text', text: 'warm 50m' })).toBeDefined()
    await band.unmount()
    await clock.advance(HOUR)
    const cold = await $.ui.mount({ ...BAND, surface: 'desktop' })
    expect(await cold.find({ type: 'Text', text: '○ cold · resume 200k tokens · new chat 47k' })).toBeDefined()
    await cold.unmount()
  })

  test('/clear empties the cache, and /deskbar off hides the band', async ($, on) => {
    await startSession($, on)
    await respond($)
    await $.session.end({ reason: 'clear', sessionId: 'chat-1', resume: { id: 'chat-1' } } as never)
    const cleared = await $.ui.mount({ ...BAND, surface: 'desktop' })
    expect(await cleared.find({ type: 'Text', text: '○ ?' })).toBeDefined()
    await cleared.unmount()

    expect((await $.command.run({ command: 'deskbar', args: 'off', ...RUN })).text).toBe('Deskbar is off.')
    const off = await $.ui.mount({ ...BAND, surface: 'desktop' })
    expect(await off.find({ key: 'deskbar' })).toBeUndefined()
    await off.unmount()
    expect((await $.command.run({ command: 'deskbar', args: 'on', ...RUN })).text).toBe('Deskbar is on.')
    expect((await $.command.run({ command: 'deskbar', args: 'what', ...RUN })).text).toContain('/deskbar on')
  })

  test('a survey question keeps the band out of its way', async ($, on) => {
    await startSession($, on)
    const band = await $.ui.mount({ ...BAND, props: { ...BAND.props, hasSurvey: true }, surface: 'desktop' })
    expect(await band.find({ key: 'deskbar' })).toBeUndefined()
    await band.unmount()
  })

  test('after a /clear wipes the session\'s values, the on/off is written again from what was saved', async ($, on) => {
    const written: unknown[] = []
    // The wiped session: the value reads as never written, and each write is recorded.
    on('state.get', () => ({ value: { value: undefined, version: 0 } }) as never)
    on('state.set', (_$, e) => (written.push([e.key, e.value]), { value: { isSet: true, version: 1 } }) as never)
    await startSession($, on, { stored: { isOn: false } })
    written.length = 0
    await $.session.end({ reason: 'clear', sessionId: 'chat-1', resume: { id: 'chat-1' } } as never)
    await clock.advance(300)
    expect(written).toContainEqual(['isOn', false])
  })
})
