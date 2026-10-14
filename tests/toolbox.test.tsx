import { describe, expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { modelAlias, prettyModel } from '../hooks/toolbox/text'

const NOW = Date.parse('2026-10-14T10:00:00Z')
const SURFACES = ['terminal', 'desktop'] as const
const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } } as const

const FOOTER = { plugin: 'rhazi3l-mods', component: 'SessionMode', props: { modes: [] } } as const
const BAND = {
  plugin: 'rhazi3l-mods',
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

/** The engine's own answers beneath the plugin; returns the commands it ran. */
async function startSession($: Engine, on: On) {
  const ran: string[] = []
  mock.clock(on, { now: NOW })
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
      expect(await band.find({ key: 'mod-clean-view' })).toMatchObject({ text: '● Clean View' })
      expect(await band.find({ type: 'Text', text: '●' })).toMatchObject({ props: { color: 'success' } })

      expect(await band.find({ key: 'toolbox-close' })).toMatchObject({ props: { hotkey: 'x' } })
      await band.press({ key: 'toolbox-close' })
      expect(await band.find({ key: 'toolbox-panel' })).toBeUndefined()
      await footer.unmount()
      await band.unmount()
    }
  })

  test('/toolbox opens it, and its Mods buttons switch a mod off', async ($, on) => {
    await startSession($, on)
    await $.command.run({ command: 'toolbox', args: '', ...RUN })
    const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
    await band.press({ key: 'mod-clean-view' })
    expect(await band.find({ key: 'mod-clean-view' })).toMatchObject({ text: '○ Clean View' })
    await band.unmount()
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
})
