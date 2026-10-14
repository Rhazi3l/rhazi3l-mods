import { describe, expect, mock, test } from 'claude-code/testing'
import type { Engine, MockClock } from 'claude-code/testing'
import type { On } from 'claude-code'

import { modelAlias, prettyModel } from '../hooks/text'

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

  test('the footer reads toolbox; the corner panel has no usage; effort runs /effort', async ($, on) => {
    const ran = await startSession($, on)
    const footer = await $.ui.mount({ ...FOOTER, surface: 'terminal' })
    expect(await footer.find({ type: 'Text', text: 'toolbox' })).toBeDefined()
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

  test('with Prompt Upgrade installed too, it gets its own button that runs /better off', async ($, on) => {
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
      expect(await band.find({ key: 'mod-prompt-upgrade' })).toMatchObject({ text: '● Prompt Upgrade' })
      await band.unmount()
    }
    const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
    await band.press({ key: 'mod-prompt-upgrade' })
    expect(ran).toContain('better off')
    await band.unmount()
  })
})
