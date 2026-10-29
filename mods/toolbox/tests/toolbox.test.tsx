import { describe, expect, mock, test } from 'claude-code/testing'
import type { Engine, MockClock } from 'claude-code/testing'
import type { On } from 'claude-code'

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

/** Stands in for sibling mods: each one's on/off value and command; registered before the session starts. */
function fakeMod(on: On, ran: string[], mods: readonly { id: string; command: string }[] = [{ id: 'clean-view', command: 'view' }]) {
  const values = new Map(mods.map(mod => [mod.id, { isOn: true, version: 1 }]))
  on('state.get', ($, e, next) => {
    const held = e.key === 'isOn' ? values.get(e.plugin) : undefined
    return held ? ({ value: { value: held.isOn, version: held.version } } as never) : next(e)
  })
  for (const { id, command } of mods) {
    on('command.run', { command }, ($, e) => {
      ran.push(`${command} ${e.args}`)
      const held = values.get(id)
      if (held) values.set(id, { isOn: e.args === 'on', version: held.version + 1 })
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
      expect(await band.find({ key: 'model-opus' })).toBeDefined()
      expect(await band.find({ key: 'effort-high' })).toBeDefined()

      expect(await band.find({ key: 'toolbox-close' })).toMatchObject({ props: { hotkey: 'x' } })
      await band.press({ key: 'toolbox-close' })
      expect(await band.find({ key: 'toolbox-panel' })).toBeUndefined()
      await footer.unmount()
      await band.unmount()
    }
  })

  test('rows are laid out by boxes, so the desktop app wraps them rather than overlapping', async ($, on) => {
    await startSession($, on)
    await $.command.run({ command: 'toolbox', args: '', ...RUN })
    for (const surface of SURFACES) {
      const band = await $.ui.mount({ ...BAND, surface })
      const model = await band.find({ key: 'toolbox-model' })
      expect(model).toBeDefined()
      expect(JSON.stringify(model)).toContain('"width":8')
      expect(JSON.stringify(model)).toContain('"flexWrap":"wrap"')
      expect(await band.find({ type: 'Text', text: /^Model {2,}/ })).toBeUndefined()
      await band.unmount()
    }
  })

  test('with no other mods installed, there is no Mods row and /mods says how to add one', async ($, on) => {
    await startSession($, on)
    await $.command.run({ command: 'toolbox', args: '', ...RUN })
    for (const surface of SURFACES) {
      const band = await $.ui.mount({ ...BAND, surface })
      expect(await band.find({ key: 'toolbox-mods' })).toBeUndefined()
      await band.unmount()
    }
    const listed = await $.command.run({ command: 'mods', args: '', ...RUN })
    expect(listed.text).toContain('/plugin install clean-view')
    expect(listed.text).toContain('/plugin install prompt-upgrade')
    expect(listed.text).toContain('/plugin install deskbar')
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

    const listed = await $.command.run({ command: 'mods', args: '', ...RUN })
    expect(listed.text).toContain('● **Clean View**')
    const turnedOff = await $.command.run({ command: 'mods', args: 'clean view off', ...RUN })
    expect(turnedOff.text).toBe('Switching Clean View off.')
    await clock.advance(1)
    expect(viewed).toEqual(['view off', 'view on', 'view off'])
    expect(toasts).toContain('Clean View is off.')
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
    fakeMod(on, ran, [
      { id: 'clean-view', command: 'view' },
      { id: 'prompt-upgrade', command: 'better' },
    ])
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
    fakeMod(on, ran, [{ id: 'deskbar', command: 'deskbar' }])
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
    const listed = await $.command.run({ command: 'mods', args: '', ...RUN })
    expect(listed.text).toContain('**Deskbar**')
  })
})
