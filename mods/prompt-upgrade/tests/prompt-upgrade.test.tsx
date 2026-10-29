import { describe, expect, mock, test } from 'claude-code/testing'
import type { Engine, MockClock } from 'claude-code/testing'
import type { On } from 'claude-code'

import { PASTEL } from '../hooks/palette'
import { buildRequest, countWords, fillPlaceholders, findPlaceholders, isTooShort, isUnchanged, parseUpgrade, plural } from '../hooks/text'

const SURFACES = ['terminal', 'desktop'] as const
const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } } as const
const PANE = {
  plugin: 'prompt-upgrade',
  component: 'Pane',
  requestId: 'prompt-upgrade',
  props: { title: 'Prompt Upgrade', isFocused: true, bodyColumns: 90, placement: 'inline', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

const FOOTER = { plugin: 'prompt-upgrade', component: 'SessionMode', props: { modes: [] } } as const

const ROUGH = 'make me a landing page for my bakery'
const ANSWER = JSON.stringify({
  prompt: 'Build a one-page landing page for my bakery, for local customers, in plain HTML and CSS. Done means it opens in a browser. Opening hours: [opening hours].',
  added: ['Who it is for', 'The format', 'What done looks like'],
})

let clock: MockClock
/** What is typed in the prompt box. */
let draft = ''

type Seen = { submitted: string[]; closed: string[]; modelCalls: number; toasts: string[]; filled: string[] }

/** The engine's own answers beneath the plugin. */
async function startSession(
  $: Engine,
  on: On,
  reply: () => unknown = () => ({ isAnswered: true, text: ANSWER }),
  placed: unknown = { isPlaced: true },
) {
  const seen: Seen = { submitted: [], closed: [], modelCalls: 0, toasts: [], filled: [] }
  draft = ''
  clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('ui.render', { component: 'SessionMode' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  on('ui.open', () => ({ value: placed }) as never)
  on('ui.close', ($, e) => (seen.closed.push(e.id), { value: undefined }) as never)
  on('ui.toast', ($, e) => (seen.toasts.push(String(e.text)), { value: undefined }) as never)
  on('model.complete', () => (seen.modelCalls++, { value: reply() }) as never)
  on('prompt.read', () => ({ value: { text: draft, cursor: draft.length } }) as never)
  on('prompt.fill', ($, e) => (seen.filled.push(e.text), { isFilled: true }) as never)
  on('prompt.submit', ($, e) => (seen.submitted.push(e.text), { text: e.text }) as never)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  return seen
}

/** Runs /better and lets the background work after it finish. */
async function better($: Engine, args: string) {
  const answered = await $.command.run({ command: 'better', args, ...RUN })
  await clock.advance(10)
  return answered
}

describe('reading the answer', () => {
  test('plain JSON, a fenced block and text around it all read', async () => {
    expect(parseUpgrade(ANSWER)?.added).toHaveLength(3)
    expect(parseUpgrade('```json\n' + ANSWER + '\n```')?.upgraded).toContain('landing page')
    expect(parseUpgrade('Here you go: ' + ANSWER + ' Hope it helps.')?.upgraded).toContain('[opening hours]')
  })

  test('an answer with no prompt, bad JSON or an empty prompt does not read', async () => {
    expect(parseUpgrade('I could not do that.')).toBeNull()
    expect(parseUpgrade('{"prompt": 3}')).toBeNull()
    expect(parseUpgrade('{"prompt": "  "}')).toBeNull()
    expect(parseUpgrade('{"prompt": "ok", "added": "nope"}')).toEqual({ upgraded: 'ok', added: [] })
  })

  test('the request asks a cheap model and holds the rules', async () => {
    const request = buildRequest(ROUGH)
    expect(request.model).toBe('haiku')
    expect(String(request.system)).toContain('[placeholder]')
    expect(String(request.system)).toContain('British English')
    expect(String(request.prompt)).toContain(ROUGH)
    expect(countWords('  one two   three ')).toBe(3)
  })
})

describe('placeholders', () => {
  test('placeholders are found once each, in order, without the brackets', async () => {
    expect(findPlaceholders('Hours: [opening hours]. Name: [bakery name]. Again: [opening hours].')).toEqual(['opening hours', 'bakery name'])
    expect(findPlaceholders('No blanks here, just [x] and [ ] and a [link](https://a.b).')).toEqual([])
  })

  test('filled blanks are replaced everywhere, empty ones stay as they were', async () => {
    const text = 'Hours: [opening hours]. Name: [bakery name]. Hours again: [opening hours].'
    expect(fillPlaceholders(text, { 'opening hours': '07:00 to 17:00' })).toBe('Hours: 07:00 to 17:00. Name: [bakery name]. Hours again: 07:00 to 17:00.')
    expect(fillPlaceholders(text, { 'bakery name': '   ' })).toBe(text)
  })
})

describe('small words', () => {
  test('plurals, short prompts and unchanged answers', async () => {
    expect(plural(1, 'word')).toBe('1 word')
    expect(plural(0, 'blank')).toBe('0 blanks')
    expect(isTooShort('testing')).toBe(true)
    expect(isTooShort('fix the login bug')).toBe(false)
    expect(isUnchanged('Fix the bug.', 'fix the bug', ['x'])).toBe(true)
    expect(isUnchanged('fix the bug', 'fix the bug in the login form', [])).toBe(false)
    expect(isUnchanged('fix the bug', 'Fix the bug now', [])).toBe(true)
    expect(isUnchanged('fix the bug', 'Fix the bug in the login form', ['Where'])).toBe(false)
  })
})

describe('the /better flow', () => {
  test('a prompt under four words is not sent to the model, from /better or the button', async ($, on) => {
    const seen = await startSession($, on)
    expect((await $.command.run({ command: 'better', args: 'testing', ...RUN })).text).toContain('Already short')
    draft = 'hi there'
    const footer = await $.ui.mount({ ...FOOTER, surface: 'desktop' })
    await footer.press({ key: 'pu-upgrade' })
    await footer.unmount()
    expect(seen.modelCalls).toBe(0)
    expect(seen.toasts).toEqual([expect.stringContaining('Already short')])
  })

  test('an answer with nothing added says so and offers to send the original', async ($, on) => {
    const seen = await startSession($, on, () => ({ isAnswered: true, text: JSON.stringify({ prompt: ROUGH, added: [] }) }))
    await better($, ROUGH)
    for (const surface of SURFACES) {
      const pane = await $.ui.mount({ ...PANE, surface })
      expect(await pane.find({ type: 'Text', text: 'Already clear. Nothing to add.' })).toBeDefined()
      expect(await pane.find({ key: 'pu-upgraded' })).toBeUndefined()
      expect(await pane.find({ key: 'pu-edit' })).toBeUndefined()
      expect(await pane.find({ key: 'pu-run' })).toMatchObject({ props: { label: 'Send as it is', variant: 'primary' } })
      await pane.unmount()
    }
    const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
    await pane.press({ key: 'pu-run' })
    await pane.unmount()
    expect(seen.submitted).toEqual([ROUGH])
  })

  test('/better answers at once, then the pane shows the prompt beside the upgrade on both surfaces', async ($, on) => {
    const seen = await startSession($, on)
    const answered = await better($, ROUGH)
    expect(answered.text).toContain('Upgrading')
    expect(seen.modelCalls).toBe(1)
    for (const surface of SURFACES) {
      const pane = await $.ui.mount({ ...PANE, surface })
      expect(await pane.find({ type: 'Text', text: ROUGH })).toBeDefined()
      expect(await pane.find({ type: 'Text', text: /^Build a one-page landing page/ })).toBeDefined()
      const upgraded = parseUpgrade(ANSWER)?.upgraded ?? ''
      expect(await pane.find({ type: 'Text', text: `${countWords(ROUGH)} words → ${countWords(upgraded)} words · 3 details added` })).toBeDefined()
      expect(await pane.find({ type: 'Text', text: '+ Who it is for' })).toBeDefined()
      expect(await pane.find({ key: 'pu-run' })).toMatchObject({ props: { variant: 'primary' } })
      expect(await pane.find({ key: 'pu-edit' })).toBeDefined()
      expect(await pane.find({ key: 'pu-copy' })).toBeDefined()
      expect(await pane.find({ key: 'pu-cancel' })).toBeDefined()
      await pane.unmount()
    }
  })

  test('layout is boxes that wrap: buttons wrap, and the cards stack when the pane is narrow', async ($, on) => {
    await startSession($, on)
    await better($, ROUGH)
    for (const surface of SURFACES) {
      const wide = await $.ui.mount({ ...PANE, surface })
      expect(JSON.stringify(await wide.find({ key: 'pu-run' }))).toBeDefined()
      expect(JSON.stringify(await wide.find({ key: 'pu-upgraded' }))).toContain(`"borderColor":"${PASTEL.working}"`)
      await wide.unmount()
      const narrow = await $.ui.mount({ ...PANE, surface, props: { ...PANE.props, bodyColumns: 50 } })
      expect(await narrow.find({ key: 'pu-upgraded' })).toBeDefined()
      expect(await narrow.find({ key: 'pu-original' })).toBeDefined()
      await narrow.unmount()
    }
  })

  test('Run it sends the upgrade and closes the pane; nothing is sent before that', async ($, on) => {
    const seen = await startSession($, on)
    await better($, ROUGH)
    expect(seen.submitted).toEqual([])
    const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
    await pane.press({ key: 'pu-run' })
    expect(seen.submitted).toHaveLength(1)
    expect(seen.submitted[0]).toContain('[opening hours]')
    expect(seen.closed).toEqual(['prompt-upgrade'])
    await pane.unmount()
  })

  test('each [placeholder] gets a field; typing fills the upgrade live, and Run it sends the filled text', async ($, on) => {
    const seen = await startSession($, on)
    await better($, ROUGH)
    for (const surface of SURFACES) {
      const pane = await $.ui.mount({ ...PANE, surface })
      expect(await pane.find({ key: 'pu-fill-0' })).toBeDefined()
      expect(await pane.find({ key: 'pu-fill-1' })).toBeUndefined()
      expect(await pane.find({ type: 'Text', text: /0 of 1 blank filled/ })).toBeDefined()
      await pane.unmount()
    }
    const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
    await pane.input({ key: 'pu-fill-0', text: '07:00 to 17:00', kind: 'change' })
    expect(await pane.find({ key: 'pu-upgraded' })).toMatchObject({ text: expect.stringContaining('Opening hours: 07:00 to 17:00.') })
    expect(await pane.find({ type: 'Text', text: /1 of 1 blank filled/ })).toBeDefined()
    await pane.press({ key: 'pu-run' })
    expect(seen.submitted).toHaveLength(1)
    expect(seen.submitted[0]).toContain('Opening hours: 07:00 to 17:00.')
    expect(seen.submitted[0]).not.toContain('[opening hours]')
    await pane.unmount()
  })

  test('Edit in prompt box puts the filled text in the main prompt box and closes the pane, sending nothing', async ($, on) => {
    const seen = await startSession($, on)
    await better($, ROUGH)
    const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
    await pane.input({ key: 'pu-fill-0', text: '08:00 to 16:00', kind: 'change' })
    await pane.press({ key: 'pu-edit' })
    expect(seen.filled).toHaveLength(1)
    expect(seen.filled[0]).toContain('Opening hours: 08:00 to 16:00.')
    expect(seen.closed).toEqual(['prompt-upgrade'])
    expect(seen.submitted).toEqual([])
    await pane.unmount()
  })

  test('Cancel closes the pane and sends nothing', async ($, on) => {
    const seen = await startSession($, on)
    await better($, ROUGH)
    const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
    await pane.press({ key: 'pu-cancel' })
    expect(seen.closed).toEqual(['prompt-upgrade'])
    expect(seen.submitted).toEqual([])
    await pane.unmount()
  })

  test('a failed model call shows a calm card with Try again, Send my original and Cancel', async ($, on) => {
    let works = false
    const seen = await startSession($, on, () => (works ? { isAnswered: true, text: ANSWER } : { isAnswered: false, reason: 'api-error' }))
    await better($, ROUGH)
    for (const surface of SURFACES) {
      const pane = await $.ui.mount({ ...PANE, surface })
      expect(await pane.find({ type: 'Text', text: 'Your prompt is safe.' })).toBeDefined()
      expect(await pane.find({ key: 'pu-retry' })).toBeDefined()
      expect(await pane.find({ key: 'pu-send-original' })).toBeDefined()
      expect(await pane.find({ key: 'pu-cancel' })).toBeDefined()
      await pane.unmount()
    }
    const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
    await pane.press({ key: 'pu-send-original' })
    expect(seen.submitted).toEqual([ROUGH])
    await pane.unmount()

    works = true
    await better($, ROUGH)
    const again = await $.ui.mount({ ...PANE, surface: 'terminal' })
    expect(await again.find({ key: 'pu-run' })).toBeDefined()
    await again.unmount()
  })

  test('with no room for the pane, nothing is asked of the model and one line says why', async ($, on) => {
    const seen = await startSession($, on, undefined, { isPlaced: false, reason: 'too-narrow' })
    await better($, ROUGH)
    expect(seen.modelCalls).toBe(0)
    expect(seen.toasts.join(' ')).toContain('Widen the window')
  })
})

describe('the footer button on each surface', () => {
  test('both surfaces name it with one short word, so the Info button keeps its room', async ($, on) => {
    await startSession($, on)
    const term = await $.ui.mount({ ...FOOTER, surface: 'terminal' })
    expect(await term.find({ key: 'pu-upgrade' })).toMatchObject({ text: '✦ Better' })
    await term.unmount()
    const desk = await $.ui.mount({ ...FOOTER, surface: 'desktop' })
    const button = await desk.find({ key: 'pu-upgrade' })
    expect(button).toMatchObject({ text: '✦ Better' })
    expect(await desk.find({ key: 'pu-footer' })).toMatchObject({ props: { flexShrink: 0 } })
    await desk.unmount()
  })
})

describe('the Better button', () => {
  test('it sits in the prompt footer on both surfaces, and pressing it upgrades what is typed', async ($, on) => {
    const seen = await startSession($, on)
    draft = ROUGH
    for (const surface of SURFACES) {
      const band = await $.ui.mount({ ...FOOTER, surface })
      expect(await band.find({ key: 'pu-upgrade' })).toBeDefined()
      await band.unmount()
    }
    const band = await $.ui.mount({ ...FOOTER, surface: 'terminal' })
    await band.press({ key: 'pu-upgrade' })
    await clock.advance(10)
    expect(seen.modelCalls).toBe(1)
    const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
    expect(await pane.find({ type: 'Text', text: ROUGH })).toBeDefined()
    await band.unmount()
    await pane.unmount()
  })

  test('with nothing typed, it asks the model nothing and says what to do', async ($, on) => {
    const seen = await startSession($, on)
    draft = '   '
    const band = await $.ui.mount({ ...FOOTER, surface: 'terminal' })
    await band.press({ key: 'pu-upgrade' })
    await clock.advance(10)
    expect(seen.modelCalls).toBe(0)
    expect(seen.toasts.join(' ')).toContain('Type a prompt first')
    await band.unmount()
  })

  test('Run it sends the upgrade and clears the draft it came from, but leaves a changed draft alone', async ($, on) => {
    const seen = await startSession($, on)
    draft = ROUGH
    await better($, ROUGH)
    const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
    await pane.press({ key: 'pu-run' })
    expect(seen.filled).toEqual([''])
    await pane.unmount()

    seen.filled.length = 0
    await better($, ROUGH)
    draft = 'something else I started typing'
    const again = await $.ui.mount({ ...PANE, surface: 'terminal' })
    await again.press({ key: 'pu-run' })
    expect(seen.filled).toEqual([])
    await again.unmount()
  })

  test('off hides the footer button and on brings it back; /better with a prompt works either way', async ($, on) => {
    const seen = await startSession($, on)
    expect((await $.command.run({ command: 'better', args: 'off', ...RUN })).text).toBe('The Better button is off.')
    const off = await $.ui.mount({ ...FOOTER, surface: 'terminal' })
    expect(await off.find({ key: 'pu-upgrade' })).toBeUndefined()
    await off.unmount()
    expect(seen.modelCalls).toBe(0)
    await better($, ROUGH)
    expect(seen.modelCalls).toBe(1)

    expect((await $.command.run({ command: 'better', args: 'on', ...RUN })).text).toBe('The Better button is on.')
    const shown = await $.ui.mount({ ...FOOTER, surface: 'terminal' })
    expect(await shown.find({ key: 'pu-upgrade' })).toBeDefined()
    await shown.unmount()
  })

  test('bare /better says how to use the button', async ($, on) => {
    await startSession($, on)
    expect((await $.command.run({ command: 'better', args: '', ...RUN })).text).toContain('Better')
  })
})
