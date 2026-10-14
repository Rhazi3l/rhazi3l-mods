import { describe, expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { cleanName, describeAction } from '../hooks/clean-view/text'

const PREFIX = 'mcp__rhazi3l-mods__'
const PLAN = 'mcp__rhazi3l-mods__plan_steps'
const PROGRESS = 'mcp__rhazi3l-mods__report_progress'
const SURFACES = ['terminal', 'desktop'] as const
const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } } as const

const BAND = {
  plugin: 'rhazi3l-mods',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: true,
    maxRows: 20,
    bodyColumns: 90,
    scroll: { offset: 0, bodyRows: 19 },
    view: {},
  },
} as const

/** The engine's own answers beneath the plugin. */
async function startSession($: Engine, on: On) {
  mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('prompt.submit', ($, e) => ({ text: e.text }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('prompt.compose', () => ({ sections: [] }))
  on('classic.Notification', () => ({}))
  on('tool.call', { tool: 'TodoWrite' }, ($, e) => ({ result: { oldTodos: [], newTodos: e.todos } }))
  on('tool.call', { tool: 'Read' }, () => ({ result: { type: 'text' } as never }))
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
}

/** A session with one job running. */
async function startJob($: Engine, on: On) {
  await startSession($, on)
  await $.prompt.submit({ text: 'Build my landing page', wait: false })
  await $.turn.start({ text: 'Build my landing page', turnId: 't1' })
}

describe('plain names', () => {
  test('backtick code, paths and long names are cleaned', async () => {
    expect(cleanName('Build the pricing section in `src/Pricing.tsx`')).toBe('Build the pricing section in')
    expect(cleanName('update ~/.config/hypr/input.lua then reload')).toBe('Update then reload')
    expect(cleanName('fix Pricing.tsx layout')).toBe('Fix layout')
    const long = 'Write a very long step name that keeps going well past the forty character limit'
    expect(long.length).toBeGreaterThan(70)
    expect(cleanName(long).length).toBeLessThanOrEqual(40)
    expect(cleanName(long)).toEndWith('…')
    expect(cleanName('`npm test`')).toBe('Working on it')
  })

  test('the technical layer names skills, websites, connectors and commands', async () => {
    expect(describeAction('Skill', { skill: 'omarchy' }, PREFIX)?.detail).toBe('omarchy')
    expect(describeAction('WebFetch', { url: 'https://wiki.hyprland.org/Configuring/?x=1' }, PREFIX)?.detail).toBe(
      'wiki.hyprland.org/Configuring',
    )
    expect(describeAction('mcp__claude_ai_Gmail__search_threads', {}, PREFIX)?.detail).toBe('Gmail → search threads')
    expect(describeAction('Bash', { command: 'git push origin main', description: 'Push the config' }, PREFIX)?.detail).toBe(
      'Push the config (git push)',
    )
    expect(describeAction(PLAN, {}, PREFIX)).toBeNull()
    expect(describeAction('TodoWrite', {}, PREFIX)).toBeNull()
  })
})

describe('checklist', () => {
  test('a to-do list plus a 60% report draws done, 60%, Next and Up next', async ($, on) => {
    await startJob($, on)
    await $.tool.call({
      tool: 'TodoWrite',
      todos: [
        { content: 'Read your brand notes', status: 'completed', activeForm: 'Reading' },
        { content: 'Build the pricing section', status: 'in_progress', activeForm: 'Building' },
        { content: 'Add the contact form', status: 'pending', activeForm: 'Adding' },
        { content: 'Polish the footer', status: 'pending', activeForm: 'Polishing' },
      ],
    })
    await $.tool.call({ tool: PROGRESS, task: 'Build the pricing section', percent: 60 } as never)

    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ ...BAND, surface })
      expect(await ui.find({ type: 'Text', text: /✓/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: '60%' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /^Next$/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: 'Up next' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /▶/ })).toBeDefined()
      expect(await ui.find({ key: 'clean-view-style' })).toBeDefined()
      expect(await ui.find({ key: 'mod-clean-view' })).toBeDefined()
      await ui.unmount()
    }
  })

  test('a permission prompt shows Needs you', async ($, on) => {
    await startJob($, on)
    await $.classic.Notification({ message: 'Claude needs your permission to use Bash', notification_type: 'permission_prompt' })
    const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
    expect(await ui.find({ type: 'Text', text: /Needs you/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /needs your OK/ })).toBeDefined()
    await ui.unmount()
  })

  test('plan_steps then report_progress at 100 checks off step one and starts step two', async ($, on) => {
    await startJob($, on)
    const planned = await $.tool.call({ tool: PLAN, steps: ['Read your notes', 'Build the page', 'Polish it'] } as never)
    expect(planned.text ?? JSON.stringify(planned.result)).toContain('Planned 3 steps')
    await $.tool.call({ tool: PROGRESS, task: 'Read your notes', percent: 100 } as never)

    const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
    const labels = await ui.findAll({ type: 'Text', text: /^(Done|Working|Next|Up next|\d+%)$/ })
    expect(labels.map(label => label.text)).toEqual(['Done', 'Working', 'Next'])
    expect(await ui.find({ type: 'Text', text: /Build the page/ })).toMatchObject({ props: { bold: true } })
    await ui.unmount()
  })

  test('tools are denied before a plan exists and allowed after', async ($, on) => {
    await startJob($, on)
    const before = await $.tool.call({ tool: 'Read', file_path: '/tmp/a.md' })
    expect(before.deny ?? before.text ?? '').toContain('plan_steps')
    await $.tool.call({ tool: PLAN, steps: ['Read your notes'] } as never)
    const after = await $.tool.call({ tool: 'Read', file_path: '/tmp/a.md' })
    expect(after.deny).toBeUndefined()
    expect(after.isError).toBeUndefined()
  })

  test('Guided shows one plain line for a tool row, Simple hides it', async ($, on) => {
    await startJob($, on)
    const row = {
      plugin: 'rhazi3l-mods',
      component: 'ToolUse',
      props: {
        tool_use_id: 'tu1',
        tool: 'WebFetch',
        input: { url: 'https://wiki.hyprland.org/Configuring/Variables/' },
        isRunning: false,
        isErrored: false,
        isInterrupted: false,
      },
    } as const
    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ ...row, surface })
      expect(await ui.find({ type: 'Text', text: /Read a website · wiki\.hyprland\.org/ })).toBeDefined()
      await ui.unmount()
    }
    await $.command.run({ command: 'view', args: 'simple', ...RUN })
    const hidden = await $.ui.mount({ ...row, surface: 'terminal' })
    expect(await hidden.find({ type: 'Text' })).toBeUndefined()
    await hidden.unmount()
  })
})

describe('mods row', () => {
  test('the Mods row shows while idle, and its button turns Clean View off and on', async ($, on) => {
    await startSession($, on)
    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ ...BAND, surface })
      expect(await ui.find({ key: 'mod-clean-view' })).toMatchObject({ text: '● Clean View' })
      await ui.unmount()
    }

    await $.prompt.submit({ text: 'Build my landing page', wait: false })
    await $.turn.start({ text: 'Build my landing page', turnId: 't1' })
    const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
    expect(await ui.find({ type: 'Text', text: /Understand your request/ })).toBeDefined()

    await ui.press({ key: 'mod-clean-view' })
    expect(await ui.find({ key: 'mod-clean-view' })).toMatchObject({ text: '○ Clean View' })
    expect(await ui.find({ type: 'Text', text: /Understand your request/ })).toBeUndefined()
    const free = await $.tool.call({ tool: 'Read', file_path: '/tmp/a.md' })
    expect(free.deny).toBeUndefined()

    await ui.press({ key: 'mod-clean-view' })
    expect(await ui.find({ type: 'Text', text: /Understand your request/ })).toBeDefined()
    await ui.unmount()
  })

  test('/view off hides the checklist and /mods lists the mods', async ($, on) => {
    await startJob($, on)
    await $.command.run({ command: 'view', args: 'off', ...RUN })
    const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
    expect(await ui.find({ type: 'Text', text: /Understand your request/ })).toBeUndefined()
    expect(await ui.find({ key: 'mod-clean-view' })).toMatchObject({ text: '○ Clean View' })
    await ui.unmount()

    const listed = await $.command.run({ command: 'mods', args: '', ...RUN })
    expect(JSON.stringify(listed)).toContain('Clean View')
    const turnedOn = await $.command.run({ command: 'mods', args: 'clean view on', ...RUN })
    expect(JSON.stringify(turnedOn)).toContain('Clean View is on')
  })
})
