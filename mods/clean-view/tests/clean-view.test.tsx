import { describe, expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { asksSomething, meterCells, shadeOf, WAIT_COLOURS } from '../hooks/register'
import { cleanName, describeAction, extractQuestion, quickReplies } from '../hooks/text'

const PREFIX = 'mcp__clean-view__'
const PLAN = 'mcp__clean-view__plan_steps'
const PROGRESS = 'mcp__clean-view__report_progress'
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

  test('the frame shows the question and a button per reply; pressing one sends it as the next message', async ($, on) => {
    await startJob($, on)
    await $.tool.call({ tool: PLAN, steps: ['Read your notes', 'Report back'] } as never)
    await $.turn.complete({ turnId: 't1', answer: OPTIONS, reason: 'answer' } as never)
    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ ...BAND, surface })
      expect(await ui.find({ type: 'Text', text: /Needs you/ })).toBeDefined()
      expect(await ui.find({ key: 'clean-view-question' })).toMatchObject({ text: expect.stringContaining('Which do you want?') })
      expect(await ui.find({ key: 'clean-view-reply-0' })).toMatchObject({ text: 'Option 1', props: { variant: 'primary' } })
      expect(await ui.find({ key: 'clean-view-reply-2' })).toMatchObject({ text: 'Option 3' })
      expect(await ui.find({ key: 'clean-view-frame' })).toMatchObject({ props: { borderStyle: 'bold', borderColor: shadeOf('permission') } })
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
    await $.tool.call({ tool: PLAN, steps: ['Read your notes'] } as never)
    await $.tool.call({ tool: PROGRESS, task: 'Read your notes', percent: 100 } as never)
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
    expect(await next.find({ type: 'Text', text: /Understand your request/ })).toBeDefined()
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

describe('the waiting colour', () => {
  const SWATCHES = { ...PANE, requestId: 'clean-view-colours' } as const

  test('the samples pane shows every colour as a frame with a Use button, on both surfaces', async ($, on) => {
    on('ui.open', () => ({ value: { isPlaced: true } }))
    await startJob($, on)
    expect((await $.command.run({ command: 'view', args: 'colours', ...RUN })).text).toContain('Colour samples open')
    for (const surface of SURFACES) {
      const pane = await $.ui.mount({ ...SWATCHES, surface })
      expect(WAIT_COLOURS).toHaveLength(6)
      for (const { name, shade } of WAIT_COLOURS) {
        expect(shade).toMatch(/^#[0-9a-f]{6}$/)
        expect(await pane.find({ key: `colour-${name}` })).toMatchObject({ props: { borderStyle: 'bold', borderColor: shade } })
        expect(await pane.find({ key: `colour-use-${name}` })).toBeDefined()
      }
      expect(await pane.find({ key: 'colour-use-blue' })).toMatchObject({ text: 'blue (in use)' })
      await pane.unmount()
    }
  })

  test('pressing Use changes the frame of a job that is waiting, and /view colour does the same', async ($, on) => {
    await startJob($, on)
    await $.turn.complete({ turnId: 't1', answer: 'Which one do you want?', reason: 'answer' } as never)
    const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
    expect(await band.find({ key: 'clean-view-frame' })).toMatchObject({ props: { borderColor: shadeOf('permission') } })

    const pane = await $.ui.mount({ ...SWATCHES, surface: 'terminal' })
    await pane.press({ key: 'colour-use-cyan' })
    await pane.unmount()
    const cyan = await $.ui.mount({ ...BAND, surface: 'terminal' })
    expect(await cyan.find({ key: 'clean-view-frame' })).toMatchObject({ props: { borderColor: shadeOf('suggestion') } })
    expect(await cyan.find({ type: 'Text', text: /^ Needs you $/ })).toMatchObject({ props: { backgroundColor: shadeOf('suggestion') } })
    await cyan.unmount()

    expect((await $.command.run({ command: 'view', args: 'colour red', ...RUN })).text).toBe('The waiting frame is now red.')
    expect((await $.command.run({ command: 'view', args: 'colour pink', ...RUN })).text).toContain('Pick one of')
    const red = await $.ui.mount({ ...BAND, surface: 'desktop' })
    expect(await red.find({ key: 'clean-view-frame' })).toMatchObject({ props: { borderColor: shadeOf('error') } })
    await red.unmount()
    await band.unmount()
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
    await $.tool.call({ tool: PLAN, steps: ['Read your notes', 'Report back'] } as never)
    await $.tool.call({ tool: PROGRESS, task: 'Read your notes', percent: 100 } as never)
    await $.turn.complete({ turnId: 't1', answer: 'The mods are installed.', reason: 'answer' } as never)
    const done = await $.ui.mount({ ...BAND, surface: 'terminal' })
    expect(await done.find({ type: 'Text', text: /^✓ All done · / })).toBeDefined()
    expect(await done.find({ type: 'Text', text: /Needs you/ })).toBeUndefined()
    await done.unmount()

    await $.prompt.submit({ text: 'Another job', wait: false, origin: RUN.origin })
    await $.turn.start({ text: 'Another job', turnId: 't2' })
    await $.tool.call({ tool: PLAN, steps: ['Look at it', 'Report back'] } as never)
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
    await $.command.run({ command: 'view', args: 'off', ...RUN })
    const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
    expect(await ui.find({ type: 'Text', text: /Understand your request/ })).toBeUndefined()
    const free = await $.tool.call({ tool: 'Read', file_path: '/tmp/a.md' })
    expect(free.deny).toBeUndefined()

    await $.command.run({ command: 'view', args: 'on', ...RUN })
    expect(await ui.find({ type: 'Text', text: /Understand your request/ })).toBeDefined()
    await ui.unmount()
  })
})

describe('layout on each surface', () => {
  test('the terminal sizes columns and the bar to its width; the desktop lets boxes align and buttons wrap', async ($, on) => {
    await startJob($, on)
    await $.tool.call({ tool: PLAN, steps: ['Read your notes', 'Build the page'] } as never)

    const term = await $.ui.mount({ ...BAND, surface: 'terminal' })
    expect(await term.find({ key: 'clean-view-header' })).toMatchObject({ props: { flexWrap: 'nowrap' } })
    expect(await term.find({ key: 'name' })).toMatchObject({ props: { width: expect.any(Number) } })
    const termBar = await term.find({ key: 'clean-view-overall' })
    expect((termBar?.text.match(/━/g) ?? []).length).toBeGreaterThan(40)
    await term.unmount()

    const desk = await $.ui.mount({ ...BAND, surface: 'desktop' })
    expect(await desk.find({ key: 'clean-view-header' })).toMatchObject({ props: { flexWrap: 'wrap' } })
    expect(await desk.find({ key: 'clean-view-buttons' })).toMatchObject({ props: { flexShrink: 0 } })
    expect(await desk.find({ key: 'name' })).toMatchObject({ props: { flexGrow: 1, flexShrink: 1 } })
    const deskBar = await desk.find({ key: 'clean-view-overall' })
    expect((deskBar?.text.match(/━/g) ?? []).length).toBe(20)
    expect(await desk.find({ type: 'Text', text: /^Read your notes +$/ })).toBeUndefined()
    await desk.unmount()
  })
})
