import { describe, expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { meterCells } from '../hooks/clean-view/clean-view'
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

const ROW = {
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

const PANE = {
  plugin: 'rhazi3l-mods',
  component: 'Pane',
  requestId: 'clean-view-details',
  props: {
    title: 'What Claude did',
    isFocused: false,
    bodyColumns: 90,
    placement: 'inline',
    scroll: { offset: 0, bodyRows: 40 },
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
  await $.prompt.submit({ text: 'Build my landing page', wait: false, origin: RUN.origin })
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
  test('step bars light a share, all of a done step and none of an upcoming one', async () => {
    const task = { id: 't', name: 'Build', status: 'active' as const, percent: 60, hasReported: true }
    expect(meterCells(task, 0).filter(Boolean)).toHaveLength(6)
    expect(meterCells({ ...task, status: 'done' }, 0).every(Boolean)).toBe(true)
    expect(meterCells({ ...task, status: 'upcoming' }, 0).some(Boolean)).toBe(false)
  })


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
      expect(await ui.find({ key: 'clean-view-frame' })).toMatchObject({ props: { borderStyle: 'round', borderColor: 'claude' } })
      expect(await ui.find({ key: 'clean-view-overall' })).toMatchObject({ text: expect.stringMatching(/Step 2 of 4 ━+ +40%/) })
      expect(await ui.find({ type: 'Text', text: /^━{6}$/ })).toMatchObject({ props: { color: 'claude' } })
      expect(await ui.find({ type: 'Text', text: /^━{4}$/ })).toMatchObject({ props: { color: 'subtle' } })
      await ui.unmount()
    }
  })

  test('a finished job keeps its time at the right, outside the title', async ($, on) => {
    await startJob($, on)
    await $.tool.call({ tool: PLAN, steps: ['Read your notes'] } as never)
    await $.tool.call({ tool: PROGRESS, task: 'Read your notes', percent: 100 } as never)
    await $.turn.complete({ turnId: 't1', answer: 'Done.', reason: 'end_turn' } as never)
    const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
    expect(await ui.find({ type: 'Text', text: /^✓ All done · / })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^took / })).toBeDefined()
    expect(await ui.find({ key: 'clean-view-frame' })).toMatchObject({ props: { borderColor: 'success' } })
    await ui.unmount()
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

  test('tool rows stay out of the transcript in Guided and Simple', async ($, on) => {
    on('ui.render', { component: 'ToolUse' }, ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>engine row</Text>
    })
    await startJob($, on)
    for (const style of ['guided', 'simple']) {
      await $.command.run({ command: 'view', args: style, ...RUN })
      for (const surface of SURFACES) {
        const ui = await $.ui.mount({ ...ROW, surface })
        expect(await ui.find({ type: 'Text' })).toBeUndefined()
        await ui.unmount()
      }
    }
  })

  test('Guided shows the latest action under the step in progress', async ($, on) => {
    await startJob($, on)
    await $.tool.call({ tool: PLAN, steps: ['Read your notes', 'Write the page'] } as never)
    await $.tool.call({ tool: 'Read', file_path: '/tmp/notes/brand.md' })
    await $.tool.call({ tool: 'Read', file_path: '/tmp/notes/colours.md' })
    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ ...BAND, surface })
      expect(await ui.find({ key: 'clean-view-trail' })).toMatchObject({ text: expect.stringMatching(/↳ 📄 colours\.md · 2 actions/) })
      expect(await ui.find({ key: 'clean-view-details' })).toBeDefined()
      await ui.unmount()
    }
    await $.command.run({ command: 'view', args: 'simple', ...RUN })
    const simple = await $.ui.mount({ ...BAND, surface: 'terminal' })
    expect(await simple.find({ key: 'clean-view-trail' })).toBeUndefined()
    await simple.unmount()
  })

  test('Details lists every step and action in full, and can bring the tool rows back', async ($, on) => {
    on('ui.open', () => ({ value: { isPlaced: true } }))
    on('tool.call', { tool: 'Bash' }, () => ({ result: 'failed', isError: true, text: 'bash: hugo: command not found\nmore' }) as never)
    on('ui.render', { component: 'ToolUse' }, ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>engine row</Text>
    })
    await startJob($, on)
    await $.tool.call({ tool: PLAN, steps: ['Read your notes', 'Build the site'] } as never)
    await $.tool.call({ tool: 'Read', file_path: '/tmp/notes/brand.md' })
    await $.tool.call({ tool: PROGRESS, task: 'Read your notes', percent: 100 } as never)
    await $.tool.call({ tool: 'Bash', command: 'hugo build --minify', description: 'Build the site' })

    for (const surface of SURFACES) {
      const pane = await $.ui.mount({ ...PANE, surface })
      expect(await pane.find({ type: 'Text', text: 'Read your notes' })).toBeDefined()
      expect(await pane.find({ type: 'Text', text: '/tmp/notes/brand.md' })).toBeDefined()
      expect(await pane.find({ type: 'Text', text: 'hugo build --minify' })).toBeDefined()
      expect(await pane.find({ type: 'Text', text: 'bash: hugo: command not found' })).toMatchObject({ props: { color: 'error' } })
      expect(await pane.find({ type: 'Text', text: /2 actions · 1 didn't work/ })).toBeDefined()
      await pane.unmount()
    }

    const opened = await $.command.run({ command: 'view', args: 'details', ...RUN })
    expect(opened.text).toContain('Details open')

    const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
    await pane.press({ key: 'clean-view-raw' })
    const row = await $.ui.mount({ ...ROW, surface: 'terminal' })
    expect(await row.find({ type: 'Text', text: 'engine row' })).toBeDefined()
    expect(await pane.find({ key: 'clean-view-raw' })).toMatchObject({ text: 'Hide tool output' })
    await row.unmount()
    await pane.unmount()
  })
})

describe('mods in the toolbox', () => {
  test('the toolbox shows while idle, and its button turns Clean View off and on', async ($, on) => {
    await startSession($, on)
    await $.command.run({ command: 'toolbox', args: '', ...RUN })
    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ ...BAND, surface })
      expect(await ui.find({ key: 'mod-clean-view' })).toMatchObject({ text: '● Clean View' })
      await ui.unmount()
    }

    await $.prompt.submit({ text: 'Build my landing page', wait: false, origin: RUN.origin })
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
    await $.command.run({ command: 'toolbox', args: '', ...RUN })
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
