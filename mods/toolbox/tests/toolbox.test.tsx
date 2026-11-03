import { describe, expect, mock, test } from 'claude-code/testing'
import type { Engine, MockClock } from 'claude-code/testing'
import type { On } from 'claude-code'

import { PASTEL } from '../hooks/palette'
import { capitalise, modelAlias, prettyModel } from '../hooks/text'

const NOW = Date.parse('2026-10-14T10:00:00Z')
const SURFACES = ['terminal', 'desktop'] as const
const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } } as const

const FOOTER = { plugin: 'toolbox', component: 'SessionMode', props: { modes: [] } } as const
const BAND = {
  plugin: 'toolbox',
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

/** The engine's own answers beneath the plugin; returns the commands it ran. */
async function startSession($: Engine, on: On) {
  const ran: string[] = []
  clock = mock.clock(on, { now: NOW })
  mock.store(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.run', { command: 'effort' }, ($, e) => (ran.push(`effort ${e.args}`), { text: 'ok' }))
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  // The engine's own mode labels, drawn only from the modes it is handed.
  on('ui.render', { component: 'SessionMode' }, ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box>
        {e.props.modes.map(mode => <Text key={`engine-${mode}`}>{`engine ${mode}`}</Text>)}
        <Text key="sibling">sibling button</Text>
      </Box>
    )
  })
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  return ran
}

type FakeMod = { id: string; name: string; command: string }
const CLEAN_VIEW = { id: 'clean-view', name: 'Clean View', command: 'view' }
const BETTER = { id: 'prompt-upgrade', name: 'Better', command: 'better' }
const DESKBAR = { id: 'deskbar', name: 'Deskbar', command: 'deskbar' }

/**
 * Stands in for sibling mods: each one's switchboard file and command, registered before the session starts.
 * `removed` mods left a file behind but are no longer in the installed-plugins list.
 */
function fakeMod(on: On, ran: string[], mods: readonly FakeMod[] = [CLEAN_VIEW], removed: readonly FakeMod[] = []) {
  const values = new Map([...mods, ...removed].map(mod => [mod.id, { ...mod, isOn: true }]))
  const installed = JSON.stringify({ plugins: Object.fromEntries(mods.map(mod => [`${mod.id}@rhazi3l-mods`, []])) })
  on('fs.exists', ($, e, next) => (e.path.endsWith('/mods-registry') ? ({ value: true } as never) : next(e)))
  on('fs.list', ($, e, next) =>
    e.path.endsWith('/mods-registry')
      ? ({ value: [...values.keys()].map(id => ({ name: `${id}.json`, kind: 'file', size: 1, mtimeMs: 0, isLink: false })) } as never)
      : next(e),
  )
  on('fs.read', ($, e, next) => {
    if (e.path.endsWith('/installed_plugins.json')) return { value: installed } as never
    const id = /\/mods-registry\/(.+)\.json$/.exec(e.path)?.[1]
    const held = id ? values.get(id) : undefined
    return held ? ({ value: JSON.stringify({ id, name: held.name, command: held.command, description: '', isOn: held.isOn }) } as never) : next(e)
  })
  for (const { id, command } of mods) {
    on('command.run', { command }, ($, e) => {
      ran.push(`${command} ${e.args}`)
      const held = values.get(id)
      if (held) values.set(id, { ...held, isOn: e.args === 'on' })
      return { text: 'ok' }
    })
  }
}

describe('toolbox words', () => {
  test('model names read plainly', async () => {
    expect(prettyModel('claude-opus-5-5')).toBe('Opus 5.5')
    expect(prettyModel('claude-sonnet-5-5[1m]')).toBe('Sonnet 5.5')
    expect(prettyModel('haiku')).toBe('Haiku')
    expect(modelAlias('claude-fable-5-1')).toBe('fable')
  })
})

/** The engine's answers about the session's model and advisor, and the /advisor command. */
function fakeChat(on: On, ran: string[]) {
  on('session.model', () => ({ value: 'claude-sonnet-5-5' }) as never)
  on('settings.read', () => ({ value: { advisorModel: 'opus' } }) as never)
  on('command.run', { command: 'advisor' }, ($, e) => (ran.push(`advisor ${e.args}`), { text: 'ok' }))
}

describe('button order and words', () => {
  test('models and advisors run cheapest to dearest, and efforts are capitalised', async ($, on) => {
    fakeChat(on, [])
    await startSession($, on)
    await $.command.run({ command: 'toolbox', args: '', ...RUN })
    const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
    for (const row of ['model', 'advisor']) {
      const tree = JSON.stringify(await band.find({ key: `toolbox-${row}` }))
      const at = ['haiku', 'sonnet', 'opus', 'fable'].map(alias => tree.indexOf(`${row}-${alias}"`))
      expect(at.every(i => i > -1)).toBe(true)
      expect([...at].sort((a, b) => a - b)).toEqual(at)
    }
    expect(await band.find({ key: 'effort-max' })).toMatchObject({ props: { label: 'Max' } })
    expect(await band.find({ key: 'effort-xhigh' })).toMatchObject({ props: { label: capitalise('xhigh') } })
    await band.unmount()
  })
})

describe('advisor', () => {
  test('the panel shows the advisor and its buttons run /advisor', async ($, on) => {
    const ran: string[] = []
    fakeChat(on, ran)
    await startSession($, on)
    await $.command.run({ command: 'toolbox', args: '', ...RUN })
    for (const surface of SURFACES) {
      const band = await $.ui.mount({ ...BAND, surface })
      expect(await band.find({ key: 'advisor-opus' })).toMatchObject({ props: { variant: 'primary' } })
      expect(await band.find({ key: 'advisor-off' })).toMatchObject({ props: { variant: 'secondary' } })
      expect(await band.find({ type: 'Text', text: /advises/ })).toBeUndefined()
      await band.unmount()
    }
    const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
    await band.press({ key: 'advisor-off' })
    expect(ran).toEqual(['advisor off'])
    await band.unmount()
  })
})

describe('toolbox', () => {
  test('the footer button opens and closes the panel', async ($, on) => {
    await startSession($, on)
    for (const surface of SURFACES) {
      const footer = await $.ui.mount({ ...FOOTER, surface })
      const band = await $.ui.mount({ ...BAND, surface })
      expect(await band.find({ key: 'toolbox-panel' })).toBeUndefined()

      await footer.press({ key: 'toolbox' })
      expect(await band.find({ key: 'toolbox-panel' })).toBeDefined()
      // The terminal has the Model and Effort rows; the desktop app has its own pickers.
      expect(await band.find({ key: 'model-opus' })).toEqual(surface === 'terminal' ? expect.anything() : undefined)
      expect(await band.find({ key: 'effort-high' })).toEqual(surface === 'terminal' ? expect.anything() : undefined)
      expect(await band.find({ key: 'advisor-opus' })).toBeDefined()

      expect(await band.find({ key: 'toolbox-close' })).toBeUndefined()
      await footer.press({ key: 'toolbox' })
      expect(await band.find({ key: 'toolbox-panel' })).toBeUndefined()
      await footer.unmount()
      await band.unmount()
    }
  })

  test('on the desktop the Info button carries the context figure, dim until 80% then amber and red; the terminal leaves it to the status line', async ($, on) => {
    on('session.measure', (_$, e) => ({ changed: e.changed }) as never)
    await startSession($, on)
    for (const surface of SURFACES) {
      const before = await $.ui.mount({ ...FOOTER, surface })
      expect(await before.find({ type: 'Text', text: / \d+%/ })).toBeUndefined()
      await before.unmount()
    }
    for (const [percent, color] of [[20, undefined], [85, PASTEL.stuck], [96, PASTEL.error]] as const) {
      await $.session.measure({ context: { window: 1_000_000, percent }, rateLimits: [], changed: ['context'] })
      const footer = await $.ui.mount({ ...FOOTER, surface: 'desktop' })
      const figure = await footer.find({ type: 'Text', text: ` ${percent}%` })
      expect(figure).toBeDefined()
      expect(figure?.props.color).toBe(color)
      await footer.unmount()
      const terminal = await $.ui.mount({ ...FOOTER, surface: 'terminal' })
      expect(await terminal.find({ type: 'Text', text: ` ${percent}%` })).toBeUndefined()
      await terminal.unmount()
    }
  })

  test('rows are laid out by boxes, so the desktop app wraps them rather than overlapping', async ($, on) => {
    await startSession($, on)
    await $.command.run({ command: 'toolbox', args: '', ...RUN })
    for (const surface of SURFACES) {
      const band = await $.ui.mount({ ...BAND, surface })
      const row = await band.find({ key: surface === 'terminal' ? 'toolbox-model' : 'toolbox-advisor' })
      expect(row).toBeDefined()
      expect(JSON.stringify(row)).toContain('"width":8')
      expect(JSON.stringify(row)).toContain('"flexWrap":"wrap"')
      expect(await band.find({ type: 'Text', text: /^(Model|Advisor) {2,}/ })).toBeUndefined()
      await band.unmount()
    }
  })

  test('the desktop panel gives its rows and buttons room; the terminal draws them as written', async ($, on) => {
    await startSession($, on)
    await $.command.run({ command: 'toolbox', args: '', ...RUN })
    const desktop = await $.ui.mount({ ...BAND, surface: 'desktop' })
    expect(await desktop.find({ key: 'toolbox-panel' })).toMatchObject({ props: { gap: 'sm', marginTop: 'sm' } })
    expect(JSON.stringify(await desktop.find({ key: 'toolbox-advisor' }))).toContain('"columnGap":"sm"')
    await desktop.unmount()
    const terminal = await $.ui.mount({ ...BAND, surface: 'terminal' })
    expect(JSON.stringify(await terminal.find({ key: 'toolbox-panel' }))).not.toContain('"gap"')
    expect(JSON.stringify(await terminal.find({ key: 'toolbox-model' }))).not.toContain('Gap')
    await terminal.unmount()
  })

  test('the desktop panel has no Model or Effort rows; the terminal panel has both', async ($, on) => {
    await startSession($, on)
    await $.command.run({ command: 'toolbox', args: '', ...RUN })
    const desktop = await $.ui.mount({ ...BAND, surface: 'desktop' })
    expect(await desktop.find({ key: 'toolbox-model' })).toBeUndefined()
    expect(await desktop.find({ key: 'toolbox-effort' })).toBeUndefined()
    expect(await desktop.find({ type: 'Text', text: /^(Model|Effort)$/ })).toBeUndefined()
    expect(await desktop.find({ key: 'toolbox-advisor' })).toBeDefined()
    await desktop.unmount()
    const terminal = await $.ui.mount({ ...BAND, surface: 'terminal' })
    expect(await terminal.find({ key: 'toolbox-model' })).toBeDefined()
    expect(await terminal.find({ key: 'toolbox-effort' })).toBeDefined()
    await terminal.unmount()
  })

  test('with no other mods installed, there is no Mods row', async ($, on) => {
    await startSession($, on)
    await $.command.run({ command: 'toolbox', args: '', ...RUN })
    for (const surface of SURFACES) {
      const band = await $.ui.mount({ ...BAND, surface })
      expect(await band.find({ key: 'toolbox-mods' })).toBeUndefined()
      await band.unmount()
    }
  })

  test('with Clean View installed, its button runs /view off and on', async ($, on) => {
    const viewed: string[] = []
    const toasts: string[] = []
    fakeMod(on, viewed)
    on('ui.toast', ($, e) => (toasts.push(String(e.text)), { value: undefined }) as never)
    await startSession($, on)
    await $.command.run({ command: 'toolbox', args: '', ...RUN })
    for (const surface of SURFACES) {
      const band = await $.ui.mount({ ...BAND, surface })
      expect(await band.find({ key: 'mod-clean-view' })).toMatchObject({ text: '● Clean View' })
      await band.unmount()
    }

    // The real Clean View writes its value, which redraws the panel; the stand-in
    // can't, so each check mounts the panel afresh.
    const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
    await band.press({ key: 'mod-clean-view' })
    await band.unmount()
    const after = await $.ui.mount({ ...BAND, surface: 'terminal' })
    expect(await after.find({ key: 'mod-clean-view' })).toMatchObject({ text: '○ Clean View' })
    await after.press({ key: 'mod-clean-view' })
    expect(viewed).toEqual(['view off', 'view on'])
    expect(toasts).toEqual(['Clean View is off.', 'Clean View is on.'])
    await after.unmount()
  })

  test('the footer draws the modes once and other mods\' buttons to the left of the Info button', async ($, on) => {
    await startSession($, on)
    for (const surface of SURFACES) {
      const footer = await $.ui.mount({ ...FOOTER, surface, props: { modes: ['focus'] } })
      expect(await footer.find({ type: 'Text', text: 'focus  ' })).toBeDefined()
      expect(await footer.find({ type: 'Text', text: 'engine focus' })).toBeUndefined()
      const tree = JSON.stringify(await footer.find({ type: 'Box' }))
      expect(tree.indexOf('sibling button')).toBeGreaterThan(-1)
      expect(tree.indexOf('sibling button')).toBeLessThan(tree.indexOf('Info'))
      await footer.unmount()
    }
  })

  test('the footer reads Info; the corner panel has no usage; effort runs /effort', async ($, on) => {
    const ran = await startSession($, on)
    const footer = await $.ui.mount({ ...FOOTER, surface: 'terminal' })
    expect(await footer.find({ type: 'Text', text: 'Info' })).toBeDefined()
    expect(await footer.find({ type: 'Text', text: ' ▾' })).toBeDefined()

    await footer.press({ key: 'toolbox' })
    expect(await footer.find({ type: 'Text', text: ' ▴' })).toBeDefined()
    const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
    expect(await band.find({ key: 'toolbox-panel' })).toMatchObject({ props: { alignSelf: 'flex-end' } })
    expect(await band.find({ type: 'Text', text: /Context|Usage|Cost/ })).toBeUndefined()

    await band.press({ key: 'effort-max' })
    expect(ran).toEqual(['effort max'])
    expect(await band.find({ key: 'effort-max' })).toMatchObject({ props: { variant: 'primary' } })
    await footer.unmount()
    await band.unmount()
  })

  test('with Better installed too, it gets its own button that runs /better off', async ($, on) => {
    const ran: string[] = []
    fakeMod(on, ran, [CLEAN_VIEW, BETTER])
    on('ui.toast', () => ({ value: undefined }) as never)
    await startSession($, on)
    await $.command.run({ command: 'toolbox', args: '', ...RUN })
    for (const surface of SURFACES) {
      const band = await $.ui.mount({ ...BAND, surface })
      expect(await band.find({ key: 'mod-clean-view' })).toMatchObject({ text: '● Clean View' })
      expect(await band.find({ key: 'mod-prompt-upgrade' })).toMatchObject({ text: '● Better' })
      await band.unmount()
    }
    const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
    await band.press({ key: 'mod-prompt-upgrade' })
    expect(ran).toContain('better off')
    await band.unmount()
  })

  test('with Deskbar installed, its button runs /deskbar off', async ($, on) => {
    const ran: string[] = []
    fakeMod(on, ran, [DESKBAR])
    on('ui.toast', () => ({ value: undefined }) as never)
    await startSession($, on)
    await $.command.run({ command: 'toolbox', args: '', ...RUN })
    for (const surface of SURFACES) {
      const band = await $.ui.mount({ ...BAND, surface })
      expect(await band.find({ key: 'mod-deskbar' })).toMatchObject({ text: '● Deskbar' })
      expect(await band.find({ key: 'mod-clean-view' })).toBeUndefined()
      await band.unmount()
    }
    const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
    await band.press({ key: 'mod-deskbar' })
    expect(ran).toEqual(['deskbar off'])
    await band.unmount()
  })

  test('a mod nobody told the toolbox about appears by itself, and a removed one goes', async ($, on) => {
    const ran: string[] = []
    const effort = { id: 'effort-auto', name: 'Auto Effort', command: 'effort-auto' }
    fakeMod(on, ran, [CLEAN_VIEW, effort], [DESKBAR])
    on('ui.toast', () => ({ value: undefined }) as never)
    await startSession($, on)
    await $.command.run({ command: 'toolbox', args: '', ...RUN })
    const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
    expect(await band.find({ key: 'toolbox-panel' })).toBeDefined()
    expect(await band.find({ key: 'mod-clean-view' })).toMatchObject({ text: '● Clean View' })
    expect(await band.find({ key: 'mod-effort-auto' })).toMatchObject({ text: '● Auto Effort' })
    // Deskbar left its file behind but is no longer installed.
    expect(await band.find({ key: 'mod-deskbar' })).toBeUndefined()
    await band.press({ key: 'mod-effort-auto' })
    expect(ran).toEqual(['effort-auto off'])
    await band.unmount()
  })

  test('the Effort row highlights the level Auto Effort holds, not the picker\'s', async ($, on) => {
    on('fs.read', ($, e, next) =>
      e.path.endsWith('/mods-registry/effort-auto.json')
        ? ({ value: JSON.stringify({ id: 'effort-auto', isOn: true, effort: 'high' }) } as never)
        : next(e),
    )
    on('turn.step', async function* (_$, e) {
      return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1, model: e.model } } as never
    })
    await startSession($, on)
    await $.command.run({ command: 'toolbox', args: '', ...RUN })
    for await (const chunk of $.turn.step({ turnId: 't', index: 0, model: 'claude-sonnet-5-5', messageCount: 3, effort: 'medium' } as never)) void chunk
    const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
    expect(await band.find({ key: 'effort-high' })).toMatchObject({ props: { variant: 'primary' } })
    expect(await band.find({ key: 'effort-medium' })).toMatchObject({ props: { variant: 'secondary' } })
    await band.unmount()
  })
})
