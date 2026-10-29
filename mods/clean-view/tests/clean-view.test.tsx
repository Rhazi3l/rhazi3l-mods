import { describe, expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { PASTEL } from '../hooks/palette'
import { asksSomething, barSvg, meterCells, plannedTodos, stepWindow } from '../hooks/register'
import { cleanName, describeAction, extractQuestion, quickReplies } from '../hooks/text'

const PREFIX = 'mcp__clean-view__'
const SURFACES = ['terminal', 'desktop'] as const
const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } } as const

const BAND = {
  plugin: 'clean-view',
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
  plugin: 'clean-view',
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
  plugin: 'clean-view',
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

const submitted: string[] = []

/** The engine's own answers beneath the plugin. */
async function startSession($: Engine, on: On) {
  mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  submitted.length = 0
  on('prompt.submit', ($, e) => (submitted.push(e.text), { text: e.text }))
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

/** The to-do list the checklist follows: the first `done` steps completed, the next one in progress. */
const todo = ($: Engine, names: string[], done = 0) =>
  $.tool.call({
    tool: 'TodoWrite',
    todos: names.map((content, i) => ({
      content,
      status: i < done ? 'completed' : i === done ? 'in_progress' : 'pending',
      activeForm: content,
    })),
  })

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
      'Push the config',
    )
    expect(describeAction('Artifact', { action: 'read', url: 'https://claude.ai/artifact/7UE1qe7SS7CN2KMjmWHeDG' }, PREFIX)).toMatchObject({
      label: 'Read an artifact',
      detail: 'claude.ai/artifact/7UE1qe7SS7CN2KMjmWHeDG',
    })
    expect(describeAction('Artifact', { file_path: '/tmp/page.html' }, PREFIX)?.label).toBe('Published an artifact')
    expect(describeAction('ArtifactData', { action: 'query', collection: 'notes' }, PREFIX)).toMatchObject({
      label: "Used an artifact's data",
      detail: 'query notes',
    })
    expect(describeAction('SomeNewTool', {}, PREFIX)).toMatchObject({ label: 'Used a tool', detail: 'Some new tool' })
    expect(describeAction(`${PREFIX}anything`, {}, PREFIX)).toBeNull()
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


  test('before a plan the box is one Working line, and a to-do list fills it in', async ($, on) => {
    await startJob($, on)
    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ ...BAND, surface })
      expect(await ui.find({ key: 'clean-view-frame' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: '✱ Working…' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /Up next|Understand|Plan the steps/ })).toBeUndefined()
      await ui.unmount()
    }
    await todo($, ['Read your notes', 'Write the page'])
    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ ...BAND, surface })
      expect(await ui.find({ type: 'Text', text: '✱ Working on your request' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: '✱ Working…' })).toBeUndefined()
      await ui.unmount()
    }
  })

  test('with no to-do list the Working line carries the latest action and a count', async ($, on) => {
    await startJob($, on)
    for (const surface of SURFACES) {
      const bare = await $.ui.mount({ ...BAND, surface })
      expect(await bare.find({ type: 'Text', text: '✱ Working…' })).toBeDefined()
      expect(await bare.find({ key: 'clean-view-trail' })).toBeUndefined()
      await bare.unmount()
    }
    await $.tool.call({ tool: 'Read', file_path: '/tmp/notes/brand.md' })
    await $.tool.call({ tool: 'Read', file_path: '/tmp/notes/colours.md' })
    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ ...BAND, surface })
      expect(await ui.find({ type: 'Text', text: '✱ Working…' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /· 📄 colours\.md/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: ' · 2 actions' })).toBeDefined()
      await ui.unmount()
    }
  })

  test('a job with no to-do list ends green with a plain All done', async ($, on) => {
    await startJob($, on)
    await $.turn.complete({ turnId: 't1', answer: 'Done.', reason: 'answer' } as never)
    const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
    expect(await ui.find({ type: 'Text', text: '✓ All done' })).toBeDefined()
    expect(await ui.find({ key: 'clean-view-frame' })).toMatchObject({ props: { borderColor: PASTEL.done } })
    await ui.unmount()
  })

  test('a question or a stuck job shows the box even with no to-do list', async ($, on) => {
    await startJob($, on)
    await $.turn.complete({ turnId: 't1', answer: 'Which one do you want?', reason: 'answer' } as never)
    const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
    expect(await ui.find({ key: 'clean-view-frame' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Needs you/ })).toBeDefined()
    await ui.unmount()
  })

  test('a finished job says how many steps it had, not the first step name', async ($, on) => {
    await startJob($, on)
    await todo($, ['Read your notes', 'Write the page'], 2)
    await $.turn.complete({ turnId: 't1', answer: 'Done.', reason: 'answer' } as never)
    const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
    expect(await ui.find({ type: 'Text', text: '✓ All done · 2 steps' })).toBeDefined()
    await ui.unmount()
  })

  test("the desktop app's plan tool fills the checklist and gets no line of its own", async ($, on) => {
    on('tool.call', { tool: 'mcp__ccd_turn__update_plan' }, () => ({ result: 'ok' }) as never)
    await startJob($, on)
    await $.tool.call({
      tool: 'mcp__ccd_turn__update_plan',
      items: [
        { content: 'Read your notes', status: 'completed' },
        { content: 'Write the page', status: 'in_progress' },
        { content: 'Check the links', status: 'pending' },
        { status: 'pending' },
      ],
    } as never)
    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ ...BAND, surface })
      expect(await ui.find({ type: 'Text', text: '✱ Working on your request' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: 'Write the page' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: 'Check the links' })).toBeDefined()
      expect(await ui.find({ key: 'clean-view-trail' })).toBeUndefined()
      await ui.unmount()
    }
    expect(plannedTodos('nope')).toEqual([])
    expect(plannedTodos([{ content: 'A', status: 'done' }])).toEqual([])
  })

  test("the plan tool's advance, done and start move the steps along", async ($, on) => {
    on('tool.call', { tool: 'mcp__ccd_turn__update_plan' }, () => ({ result: 'ok' }) as never)
    const plan = (args: object) => $.tool.call({ tool: 'mcp__ccd_turn__update_plan', ...args } as never)
    const doneRows = async () => {
      const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
      const n = (await ui.findAll({ type: 'Text', text: /^Done$/ })).length
      await ui.unmount()
      return n
    }
    await startJob($, on)
    await plan({
      items: ['One', 'Two', 'Three'].map((content, i) => ({ content, status: i === 0 ? 'in_progress' : 'pending' })),
      scope: 'first_task',
    })
    expect(await doneRows()).toBe(0)

    await plan({ advance: true })
    expect(await doneRows()).toBe(1)
    const second = await $.ui.mount({ ...BAND, surface: 'terminal' })
    expect(await second.find({ type: 'Text', text: 'Two' })).toMatchObject({ props: { bold: true } })
    await second.unmount()

    await plan({ done: [2], start: 3 })
    expect(await doneRows()).toBe(2)
    const third = await $.ui.mount({ ...BAND, surface: 'terminal' })
    expect(await third.find({ type: 'Text', text: 'Three' })).toMatchObject({ props: { bold: true } })
    await third.unmount()

    await plan({ advance: true })
    expect(await doneRows()).toBe(3)
    await plan({ advance: true, done: [99, 0, 'x'] })
    expect(await doneRows()).toBe(3)
  })

  test('a to-do list draws done, Working, Next and Up next', async ($, on) => {
    await startJob($, on)
    await todo($, ['Read your brand notes', 'Build the pricing section', 'Add the contact form', 'Polish the footer'], 1)

    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ ...BAND, surface })
      expect(await ui.find({ type: 'Text', text: /✓/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: 'Working' })).toBeDefined()
      // The header keeps the generic title while it would only repeat the first step's name.
      expect(await ui.find({ type: 'Text', text: '✱ Working on your request' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: '✱ Read your brand notes' })).toBeUndefined()
      expect(await ui.find({ type: 'Text', text: /^Next$/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: 'Up next' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /▶/ })).toBeDefined()
      expect(await ui.find({ key: 'clean-view-style' })).toBeUndefined()
      expect(await ui.find({ key: 'clean-view-frame' })).toMatchObject({ props: { borderStyle: 'round', borderColor: PASTEL.working } })
      // No overall Step x of y bar: the steps are the progress.
      expect(await ui.find({ key: 'clean-view-overall' })).toBeUndefined()
      expect(await ui.find({ type: 'Text', text: /Step \d/ })).toBeUndefined()
      if (surface === 'terminal') {
        const bars = await ui.findAll({ type: 'Text', text: /^━{10}$/ })
        expect(bars.map(bar => bar.props.color)).toEqual(['subtle', 'subtle', 'subtle'])
      } else {
        // The desktop draws each step's bar as an image, centred in its row, in the same colours.
        expect(await ui.find({ type: 'Text', text: /^━/ })).toBeUndefined()
        expect(await ui.find({ type: 'Svg' })).toMatchObject({ props: { alt: 'Working' } })
      }
      await ui.unmount()
    }
  })

  test('a stuck or stopped frame keeps its time at the right', async ($, on) => {
    on('tool.call', { tool: 'Bash' }, () => ({ result: 'failed', isError: true, text: 'bash: hugo: command not found' }) as never)
    await startJob($, on)
    await todo($, ['Read your notes', 'Write the page'])
    for (let i = 0; i < 3; i++) await $.tool.call({ tool: 'Bash', command: 'hugo build', description: 'Build the site' })
    const stuck = await $.ui.mount({ ...BAND, surface: 'terminal' })
    expect(await stuck.find({ type: 'Text', text: /^⚠ Stuck/ })).toBeDefined()
    expect(await stuck.find({ type: 'Text', text: /^\d+s {2}$/ })).toBeDefined()
    await stuck.unmount()

    await $.turn.complete({ turnId: 't1', answer: '', reason: 'aborted' } as never)
    const stopped = await $.ui.mount({ ...BAND, surface: 'terminal' })
    expect(await stopped.find({ type: 'Text', text: /^■ Stopped/ })).toBeDefined()
    expect(await stopped.find({ type: 'Text', text: /^\d+s {2}$/ })).toBeDefined()
    await stopped.unmount()
  })

  test('a finished job keeps its time at the right, outside the title', async ($, on) => {
    await startJob($, on)
    await todo($, ['Read your notes'], 1)
    await $.turn.complete({ turnId: 't1', answer: 'Done.', reason: 'end_turn' } as never)
    const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
    expect(await ui.find({ type: 'Text', text: /^✓ All done · / })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^took / })).toBeDefined()
    expect(await ui.find({ key: 'clean-view-frame' })).toMatchObject({ props: { borderColor: PASTEL.done } })
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

  test('completing a to-do step checks it off and starts the next', async ($, on) => {
    await startJob($, on)
    await todo($, ['Read your notes', 'Build the page', 'Polish it'])
    await todo($, ['Read your notes', 'Build the page', 'Polish it'], 1)

    const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
    const labels = await ui.findAll({ type: 'Text', text: /^(Done|Working|Next|Up next|\d+%)$/ })
    expect(labels.map(label => label.text)).toEqual(['Done', 'Working', 'Next'])
    expect(await ui.find({ type: 'Text', text: /Build the page/ })).toMatchObject({ props: { bold: true } })
    await ui.unmount()
  })

  test('no tool is held back for a plan', async ($, on) => {
    await startJob($, on)
    const before = await $.tool.call({ tool: 'Read', file_path: '/tmp/a.md' })
    expect(before.deny).toBeUndefined()
    expect(before.isError).toBeUndefined()
  })

  test('tool rows stay out of the transcript', async ($, on) => {
    on('ui.render', { component: 'ToolUse' }, ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>engine row</Text>
    })
    await startJob($, on)
    // Hidden with or without a to-do list: a short prompt stays as plain as a long one.
    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ ...ROW, surface })
      expect(await ui.find({ type: 'Text' })).toBeUndefined()
      await ui.unmount()
    }
  })

  test("a helper agent's hand-back and finished lines are hidden, a failed one is not", async ($, on) => {
    on('ui.render', { component: 'UserMessage' }, ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>engine row</Text>
    })
    await startJob($, on)
    const row = (props: object) =>
      $.ui.mount({ plugin: 'clean-view', component: 'UserMessage', surface: 'terminal', props: { text: 'x', isExpanded: false, ...props } } as never)
    const shown = async (props: object) => {
      const ui = await row(props)
      const found = (await ui.find({ type: 'Text', text: 'engine row' })) !== undefined
      await ui.unmount()
      return found
    }
    expect(await shown({ origin: { kind: 'peer' }, from: { name: 'Explore' } })).toBe(false)
    expect(await shown({ origin: { kind: 'task-notification' }, task: { id: 'a1', status: 'completed' } })).toBe(false)
    expect(await shown({ origin: { kind: 'task-notification' }, task: { id: 'a1', status: 'failed' } })).toBe(true)
    expect(await shown({ origin: { kind: 'task-notification' }, task: { id: 'a1', status: 'killed' } })).toBe(true)
    expect(await shown({ origin: { kind: 'composer' } })).toBe(true)

    await $.command.run({ command: 'view', args: 'off', ...RUN })
    expect(await shown({ origin: { kind: 'peer' }, from: { name: 'Explore' } })).toBe(true)
  })

  test('text written between tool calls is hidden, the closing answer is not', async ($, on) => {
    on('ui.render', { component: 'AssistantMessage' }, ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>engine row</Text>
    })
    on('turn.step', async function* (_$, e) {
      const answer = e.index === 0 ? 'Now the fix for the wrapping.' : 'All sorted.'
      return { turnId: e.turnId, index: e.index, answer, toolUses: e.index === 0 ? [{ id: 'u1', name: 'Bash', input: {} }] : [], stopReason: null } as never
    })
    await startJob($, on)
    for await (const _chunk of $.turn.step({ turnId: 't1', index: 0, model: 'm', messageCount: 1 } as never)) void _chunk
    for await (const _chunk of $.turn.step({ turnId: 't1', index: 1, model: 'm', messageCount: 3 } as never)) void _chunk
    const shown = async (text: string) => {
      const ui = await $.ui.mount({ plugin: 'clean-view', component: 'AssistantMessage', surface: 'terminal', props: { text, isFirstOfReply: true } } as never)
      const found = (await ui.find({ type: 'Text', text: 'engine row' })) !== undefined
      await ui.unmount()
      return found
    }

    expect(await shown('Now the fix for the wrapping.')).toBe(false)
    expect(await shown('All sorted.')).toBe(true)
    await $.command.run({ command: 'view', args: 'off', ...RUN })
    expect(await shown('Now the fix for the wrapping.')).toBe(true)
  })

  test('the spinner line is cut to its word once a plan exists, on the terminal only', async ($, on) => {
    const SPINNER = { plugin: 'clean-view', component: 'Spinner', props: { word: 'Fermenting', message: null, suffix: '…', mode: 'responding' } } as const
    on('ui.render', { component: 'Spinner' }, ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>engine spinner with to-do rows</Text>
    })
    await startJob($, on)
    const before = await $.ui.mount({ ...SPINNER, surface: 'terminal' })
    expect(await before.find({ type: 'Text', text: /engine spinner/ })).toBeDefined()
    await before.unmount()

    await todo($, ['Read your notes', 'Write the page'])
    const terminal = await $.ui.mount({ ...SPINNER, surface: 'terminal' })
    expect(await terminal.find({ type: 'Text', text: 'Fermenting…' })).toBeDefined()
    expect(await terminal.find({ type: 'Text', text: /engine spinner/ })).toBeUndefined()
    await terminal.unmount()

    const desktop = await $.ui.mount({ ...SPINNER, surface: 'desktop' })
    expect(await desktop.find({ type: 'Text', text: /engine spinner/ })).toBeDefined()
    await desktop.unmount()
  })

  test("a helper agent's own hand-back call gets no line", async () => {
    expect(describeAction('SubagentHandback', { report: '40' }, PREFIX)).toBeNull()
  })

  test('the latest action shows on the step in progress', async ($, on) => {
    await startJob($, on)
    await todo($, ['Read your notes', 'Write the page'])
    await $.tool.call({ tool: 'Read', file_path: '/tmp/notes/brand.md' })
    await $.tool.call({ tool: 'Read', file_path: '/tmp/notes/colours.md' })
    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ ...BAND, surface })
      expect(await ui.find({ key: 'clean-view-trail' })).toMatchObject({ text: expect.stringMatching(/· 📄 colours\.md · 2 actions/) })
      expect(await ui.find({ key: 'clean-view-details' })).toBeDefined()
      await ui.unmount()
    }
    // The old Simple and Guided picks are gone: /view says what is left.
    const gone = await $.command.run({ command: 'view', args: 'simple', ...RUN })
    expect(JSON.stringify(gone)).toContain('/view details')
  })

  test('Details shows what each tool answered, whole for a failure and cut when very long', async ($, on) => {
    on('tool.call', { tool: 'Bash' }, () => ({ result: 'ok', text: 'line one\nline two' }) as never)
    on('tool.call', { tool: 'Read' }, () => ({ result: 'ok', text: 'x'.repeat(5000) }) as never)
    await startJob($, on)
    await todo($, ['Look around'])
    await $.tool.call({ tool: 'Bash', command: 'ls', description: 'List files' })
    await $.tool.call({ tool: 'Read', file_path: '/tmp/big.txt' })
    const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
    expect(await pane.find({ type: 'Text', text: 'line one\nline two' })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: /… 1000 more characters$/ })).toBeDefined()
    await pane.unmount()
  })

  test('Details lists every step and action in full, and leaves the transcript clean', async ($, on) => {
    on('ui.open', () => ({ value: { isPlaced: true } }))
    on('tool.call', { tool: 'Bash' }, () => ({ result: 'failed', isError: true, text: 'bash: hugo: command not found\nmore' }) as never)
    on('ui.render', { component: 'ToolUse' }, ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>engine row</Text>
    })
    await startJob($, on)
    await todo($, ['Read your notes', 'Build the site'])
    await $.tool.call({ tool: 'Read', file_path: '/tmp/notes/brand.md' })
    await todo($, ['Read your notes', 'Build the site'], 1)
    await $.tool.call({ tool: 'Bash', command: 'hugo build --minify', description: 'Build the site' })

    for (const surface of SURFACES) {
      const pane = await $.ui.mount({ ...PANE, surface })
      expect(await pane.find({ type: 'Text', text: 'Read your notes' })).toBeDefined()
      expect(await pane.find({ type: 'Text', text: '/tmp/notes/brand.md' })).toBeDefined()
      expect(await pane.find({ type: 'Text', text: 'hugo build --minify' })).toBeDefined()
      expect(await pane.find({ type: 'Text', text: 'bash: hugo: command not found' })).toMatchObject({ props: { color: PASTEL.error } })
      expect(await pane.find({ type: 'Text', text: /2 actions · 1 error/ })).toBeDefined()
      await pane.unmount()
    }

    const opened = await $.command.run({ command: 'view', args: 'details', ...RUN })
    expect(opened.text).toContain('Details open')

    // Details shows everything in its own pane; the transcript stays clean.
    const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
    const row = await $.ui.mount({ ...ROW, surface: 'terminal' })
    expect(await row.find({ type: 'Text' })).toBeUndefined()
    expect(await pane.find({ key: 'clean-view-raw' })).toBeUndefined()
    await row.unmount()
    await pane.unmount()
  })
})

describe('replying to a question', () => {
  const OPTIONS = 'Ways to get a real review.\n\n1. I open both pages in Chrome.\n2. You export the doc.\n3. You paste the text here.\n\nI\'d go with option 1. Which do you want?'

  test('the question is the last paragraph in plain words, and numbered options become replies', async () => {
    expect(extractQuestion(OPTIONS)).toBe("I'd go with option 1. Which do you want?")
    expect(extractQuestion('Done.\n\n**Want me to push it?**')).toBe('Want me to push it?')
    expect(extractQuestion(`Intro.\n\n${'word '.repeat(100)}?`)).toStartWith('…')
    expect(quickReplies(OPTIONS).map(r => r.text)).toEqual(['Option 1', 'Option 2', 'Option 3'])
  })

  test('a yes or no question gets Yes and No, an open one gets nothing', async () => {
    expect(quickReplies('All set. Want me to push it?').map(r => r.label)).toEqual(['Yes', 'No'])
    expect(quickReplies('Should I use the long name?').map(r => r.label)).toEqual(['Yes', 'No'])
    expect(quickReplies('Which colour do you prefer?')).toEqual([])
    expect(quickReplies('1. Only one point.\n\nWhat now?')).toEqual([])
  })

  test('a numbered list that is not the choice gets no option buttons', async () => {
    const DROP =
      'Which 4 to drop:\n\n1. Time to resolve. Only 2 checks.\n2. ITIL pushback. Already tested.\n3. Finance email. A near copy.\n4. Priority target. A near copy.\n\nWant the 4 I listed, and the one-line note?'
    expect(quickReplies(DROP).map(r => r.label)).toEqual(['Yes', 'No'])
    expect(quickReplies('Steps I took:\n\n1. Read it.\n2. Fixed it.\n\nShould I push?').map(r => r.label)).toEqual(['Yes', 'No'])
    expect(quickReplies('What I found:\n\n1. A bug.\n2. A typo.\n\nWhat do you think?')).toEqual([])
    expect(quickReplies('Two ways:\n\n1. Fast.\n2. Careful.\n\nWhich do you prefer?').map(r => r.text)).toEqual(['Option 1', 'Option 2'])
  })

  test('the frame shows the question and a button per reply; pressing one sends it as the next message', async ($, on) => {
    await startJob($, on)
    await todo($, ['Read your notes', 'Report back'])
    await $.turn.complete({ turnId: 't1', answer: OPTIONS, reason: 'answer' } as never)
    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ ...BAND, surface })
      expect(await ui.find({ type: 'Text', text: /Needs you/ })).toBeDefined()
      expect(await ui.find({ key: 'clean-view-question' })).toMatchObject({ text: expect.stringContaining('Which do you want?') })
      expect(await ui.find({ key: 'clean-view-reply-0' })).toMatchObject({ text: 'Option 1', props: { variant: 'primary' } })
      expect(await ui.find({ key: 'clean-view-reply-2' })).toMatchObject({ text: 'Option 3' })
      expect(await ui.find({ key: 'clean-view-frame' })).toMatchObject({ props: { borderStyle: 'round', borderColor: PASTEL.waiting } })
      expect(await ui.find({ key: 'clean-view-replies' })).toMatchObject({ props: { flexWrap: 'wrap' } })
      await ui.unmount()
    }
    submitted.length = 0
    const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
    await ui.press({ key: 'clean-view-reply-1' })
    expect(submitted).toEqual(['Option 2'])
    await ui.unmount()
  })

  test('an answer that asks after every step is done still waits for you, and your reply starts a new job', async ($, on) => {
    await startJob($, on)
    await todo($, ['Read your notes'], 1)
    await $.turn.complete({ turnId: 't1', answer: 'All done. Want me to push it?', reason: 'answer' } as never)
    const waiting = await $.ui.mount({ ...BAND, surface: 'terminal' })
    expect(await waiting.find({ type: 'Text', text: /Needs you/ })).toBeDefined()
    expect(await waiting.find({ key: 'clean-view-reply-0' })).toMatchObject({ text: 'Yes' })
    await waiting.unmount()

    await $.prompt.submit({ text: 'Yes', wait: false, origin: RUN.origin })
    await $.turn.start({ text: 'Yes', turnId: 't2' })
    const next = await $.ui.mount({ ...BAND, surface: 'terminal' })
    expect(await next.find({ type: 'Text', text: /Needs you/ })).toBeUndefined()
    expect(await next.find({ key: 'clean-view-question' })).toBeUndefined()
    expect(await next.find({ type: 'Text', text: '✱ Working…' })).toBeDefined()
    await next.unmount()
  })

  test('a permission prompt keeps the plain banner with no question or buttons', async ($, on) => {
    await startJob($, on)
    await $.classic.Notification({ message: 'Claude needs your permission to use Bash', notification_type: 'permission_prompt' })
    const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
    expect(await ui.find({ type: 'Text', text: /needs your OK/ })).toBeDefined()
    expect(await ui.find({ key: 'clean-view-question' })).toBeUndefined()
    await ui.unmount()
  })
})

describe('frame colours', () => {
  const LEGEND = { ...PANE, requestId: 'clean-view-colours' } as const

  test('/view colours opens a legend of every frame colour and when it shows, with nothing to pick', async ($, on) => {
    on('ui.open', () => ({ value: { isPlaced: true } }))
    await startJob($, on)
    expect((await $.command.run({ command: 'view', args: 'colours', ...RUN })).text).toContain('Frame colours open')
    for (const surface of SURFACES) {
      const pane = await $.ui.mount({ ...LEGEND, surface })
      expect(await pane.find({ key: 'state-working' })).toMatchObject({ props: { borderStyle: 'round', borderColor: PASTEL.working } })
      expect(await pane.find({ key: 'state-waiting' })).toMatchObject({ props: { borderStyle: 'round', borderColor: PASTEL.waiting } })
      expect(await pane.find({ key: 'state-stuck' })).toMatchObject({ props: { borderColor: PASTEL.stuck } })
      expect(await pane.find({ key: 'state-done' })).toMatchObject({ props: { borderColor: PASTEL.done } })
      expect(await pane.find({ key: 'state-stopped' })).toMatchObject({ props: { borderColor: PASTEL.stuck } })
      expect(await pane.find({ type: 'Text', text: /^Blue: Claude asked you something/ })).toBeDefined()
      expect(await pane.find({ type: 'Text', text: /^Yellow: a step keeps failing/ })).toBeDefined()
      expect(await pane.find({ type: 'Button' })).toBeUndefined()
      await pane.unmount()
    }
  })

  test('every frame colour has its own icon, in plain coloured text with no background chip', async ($, on) => {
    on('ui.open', () => ({ value: { isPlaced: true } }))
    await startJob($, on)
    for (const surface of SURFACES) {
      const pane = await $.ui.mount({ ...LEGEND, surface })
      const icons: [string, RegExp, string][] = [
        ['state-working', /^✱ /, PASTEL.working],
        ['state-waiting', /^\? /, PASTEL.waiting],
        ['state-stuck', /^⚠ /, PASTEL.stuck],
        ['state-done', /^✓ /, PASTEL.done],
        ['state-stopped', /^■ /, PASTEL.stuck],
      ]
      for (const [key, icon, colour] of icons) {
        const frame = await pane.find({ key })
        expect(frame?.text).toMatch(icon)
        expect(JSON.stringify(frame)).toContain(`"color":"${colour}"`)
        expect(JSON.stringify(frame)).not.toContain('backgroundColor')
      }
      await pane.unmount()
    }
  })

  test('the checklist frame uses the same pastel for each state', async ($, on) => {
    await startJob($, on)
    await todo($, ['Read your notes', 'Write the page'])
    const working = await $.ui.mount({ ...BAND, surface: 'desktop' })
    expect(await working.find({ key: 'clean-view-frame' })).toMatchObject({ props: { borderColor: PASTEL.working } })
    await working.unmount()
    await $.turn.complete({ turnId: 't1', answer: 'Which one do you want?', reason: 'answer' } as never)
    const waiting = await $.ui.mount({ ...BAND, surface: 'desktop' })
    expect(await waiting.find({ key: 'clean-view-frame' })).toMatchObject({ props: { borderStyle: 'round', borderColor: PASTEL.waiting } })
    expect(await waiting.find({ type: 'Text', text: /^\? Needs you · / })).toMatchObject({ props: { color: PASTEL.waiting } })
    expect(JSON.stringify(await waiting.find({ key: 'clean-view-header' }))).not.toContain('backgroundColor')
    await waiting.unmount()
  })
})

describe('waiting for you', () => {
  test('only an answer that asks something reads as waiting', async () => {
    expect(asksSomething('Done. Want me to push it?')).toBe(true)
    expect(asksSomething('Which one do you mean?\n\n')).toBe(true)
    expect(asksSomething('All set.\n\nThe mods are installed.')).toBe(false)
    expect(asksSomething('Did it work? Yes, it did.')).toBe(false)
    expect(asksSomething('')).toBe(false)
  })

  test('an answer with a step left open ends done, unless it asks something', async ($, on) => {
    await startJob($, on)
    await todo($, ['Read your notes', 'Report back'], 1)
    await $.turn.complete({ turnId: 't1', answer: 'The mods are installed.', reason: 'answer' } as never)
    const done = await $.ui.mount({ ...BAND, surface: 'terminal' })
    expect(await done.find({ type: 'Text', text: /^✓ All done · / })).toBeDefined()
    expect(await done.find({ type: 'Text', text: /Needs you/ })).toBeUndefined()
    await done.unmount()

    await $.prompt.submit({ text: 'Another job', wait: false, origin: RUN.origin })
    await $.turn.start({ text: 'Another job', turnId: 't2' })
    await todo($, ['Look at it', 'Report back'])
    await $.turn.complete({ turnId: 't2', answer: 'Which one should I use?', reason: 'answer' } as never)
    const asking = await $.ui.mount({ ...BAND, surface: 'terminal' })
    expect(await asking.find({ type: 'Text', text: /Needs you/ })).toBeDefined()
    await asking.unmount()
  })
})

describe('tool summaries', () => {
  test('a folded tool group is hidden on the terminal and unfolded into hidden rows elsewhere', async ($, on) => {
    on('ui.render', { component: 'ToolGroup' }, ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>{e.props.isExpanded ? 'expanded' : 'Ran 2 commands'}</Text>
    })
    await startJob($, on)
    await todo($, ['Read your notes', 'Write the page'])
    const props = {
      calls: [{ tool: 'Bash', input: {}, isRunning: false, isErrored: true, isInterrupted: false }],
      isActive: false,
      isExpanded: false,
    }
    const term = await $.ui.mount({ plugin: 'clean-view', component: 'ToolGroup', surface: 'terminal', props } as never)
    expect(await term.find({ type: 'Text' })).toBeUndefined()
    await term.unmount()
    const desk = await $.ui.mount({ plugin: 'clean-view', component: 'ToolGroup', surface: 'desktop', props } as never)
    expect(await desk.find({ type: 'Text', text: 'expanded' })).toBeDefined()
    expect(await desk.find({ type: 'Text', text: 'Ran 2 commands' })).toBeUndefined()
    await desk.unmount()
  })
})

describe('on and off', () => {
  test('/view off hides the checklist and frees the tools; /view on brings it back', async ($, on) => {
    await startJob($, on)
    await todo($, ['Read your notes', 'Write the page'])
    await $.command.run({ command: 'view', args: 'off', ...RUN })
    const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
    expect(await ui.find({ type: 'Text', text: /Working on your request/ })).toBeUndefined()
    const free = await $.tool.call({ tool: 'Read', file_path: '/tmp/a.md' })
    expect(free.deny).toBeUndefined()

    await $.command.run({ command: 'view', args: 'on', ...RUN })
    expect(await ui.find({ type: 'Text', text: '✱ Working on your request' })).toBeDefined()
    await ui.unmount()
  })
})

describe('layout on each surface', () => {
  test('the terminal sizes columns and the bar to its width; the desktop lets boxes align and buttons wrap', async ($, on) => {
    await startJob($, on)
    await todo($, ['Read your notes', 'Build the page'])

    const term = await $.ui.mount({ ...BAND, surface: 'terminal' })
    expect(await term.find({ key: 'clean-view-header' })).toMatchObject({ props: { flexWrap: 'nowrap' } })
    expect(await term.find({ key: 'name' })).toMatchObject({ props: { width: expect.any(Number) } })
    await term.unmount()

    const desk = await $.ui.mount({ ...BAND, surface: 'desktop' })
    expect(await desk.find({ key: 'clean-view-header' })).toMatchObject({ props: { flexWrap: 'wrap' } })
    expect(await desk.find({ key: 'clean-view-buttons' })).toMatchObject({ props: { flexShrink: 0 } })
    expect(await desk.find({ key: 'name' })).toMatchObject({ props: { flexGrow: 1, flexShrink: 1 } })
    expect(await desk.find({ type: 'Svg' })).toMatchObject({ props: { width: 80, height: 16 } })
    expect(await desk.find({ type: 'Text', text: /^━/ })).toBeUndefined()
    expect(await desk.find({ type: 'Text', text: /^Read your notes +$/ })).toBeUndefined()
    await desk.unmount()
  })
})

describe('drawn bars', () => {
  test('barSvg draws a track with one lit run for each run of lit cells, centred in its box', async () => {
    const svg = barSvg([true, true, false, false, true], '#d4743c')
    expect(svg).toContain('width="40" height="16"')
    expect((svg.match(/<rect/g) ?? []).length).toBe(3)
    expect(svg).toContain('x="0" y="6.5" width="16"')
    expect(svg).toContain('x="32" y="6.5" width="8"')
    expect(svg).toContain('opacity="0.35"')
    expect((barSvg([false, false], '#9dcb86').match(/<rect/g) ?? []).length).toBe(1)
  })
})

const named = (n: number, doneCount = 0) =>
  Array.from({ length: n }, (_, i) => ({ id: `t${i}`, name: `Step ${i + 1}`, status: i < doneCount ? 'done' : i === doneCount ? 'active' : 'upcoming' })) as never

describe('the three-step window', () => {
  test('stepWindow shows the step in progress first, pulling back at the end', async () => {
    expect(stepWindow(named(3, 1))).toEqual({ start: 0, end: 3 })
    expect(stepWindow(named(6, 0))).toEqual({ start: 0, end: 3 })
    expect(stepWindow(named(6, 2))).toEqual({ start: 2, end: 5 })
    expect(stepWindow(named(6, 5))).toEqual({ start: 3, end: 6 })
    // Every step done: the last three.
    expect(stepWindow(named(6, 6))).toEqual({ start: 3, end: 6 })
    expect(stepWindow(named(6, 2), 4)).toEqual({ start: 2, end: 6 })
  })

  test('a long list draws three rows and one line for the rest', async ($, on) => {
    await startJob($, on)
    await todo($, ['One', 'Two', 'Three', 'Four', 'Five', 'Six'])
    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ ...BAND, surface })
      expect(await ui.find({ type: 'Text', text: /One/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /Three/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /Four/ })).toBeUndefined()
      expect(await ui.find({ type: 'Text', text: '3 more to come' })).toBeDefined()
      await ui.unmount()
    }
    await todo($, ['One', 'Two', 'Three', 'Four', 'Five', 'Six'], 2)
    const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
    expect(await ui.find({ type: 'Text', text: /^(One|Two)$/ })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /Three/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Five/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Six/ })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: '✓ 2 earlier steps done · 1 more to come' })).toBeDefined()
    await ui.unmount()
  })

  test('a short list has no summary line', async ($, on) => {
    await startJob($, on)
    await todo($, ['One', 'Two', 'Three'])
    const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
    expect(await ui.find({ key: 'clean-view-more' })).toBeUndefined()
    await ui.unmount()
  })
})
