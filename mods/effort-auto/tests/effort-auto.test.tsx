import { describe, expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const ORIGIN = { kind: 'composer' } as const

/** The engine beneath the mod: records the effort each request carries and the files written. */
async function startSession($: Engine, on: On, pickReply: string) {
  const seen = { efforts: [] as string[], files: new Map<string, string>(), toasts: [] as string[], picks: 0 }
  mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.messages', () => ({ value: [] }) as never)
  on('fs.write', ($, e) => (seen.files.set(e.path, e.text), { value: undefined }) as never)
  on('ui.toast', ($, e) => (seen.toasts.push(String(e.text)), { value: undefined }) as never)
  on('model.complete', () => (seen.picks++, { value: { isAnswered: true, text: pickReply } }) as never)
  on('prompt.submit', ($, e) => ({ text: e.text }) as never)
  on('turn.step', async function* (_$, e) {
    seen.efforts.push(String(e.effort))
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1, model: e.model } } as never
  })
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  return seen
}

async function step($: Engine, index: number, effort = 'medium', extra: { agentId?: string } = {}) {
  for await (const chunk of $.turn.step({ turnId: 't', index, model: 'claude-sonnet-5-5', messageCount: 3, effort, ...extra } as never)) void chunk
}

describe('effort auto', () => {
  test('it lists itself for the toolbox and puts the picked level on the turn', async ($, on) => {
    const seen = await startSession($, on, '{"level": "high"}')
    const file = [...seen.files.entries()].find(([path]) => path.endsWith('/mods-registry/effort-auto.json'))
    expect(JSON.parse(file![1])).toMatchObject({ id: 'effort-auto', command: 'effort-auto', isOn: true })

    await $.prompt.submit({ text: 'Check these numbers against the contract', wait: false, origin: ORIGIN })
    await step($, 0)
    await step($, 1)
    expect(seen.efforts).toEqual(['high', 'high'])
    expect(seen.picks).toBe(1)
    expect(seen.toasts).toEqual(['Effort set to High (was Medium)'])
  })

  test('off leaves the picker alone, with no model call, and says so to the toolbox', async ($, on) => {
    const seen = await startSession($, on, '{"level": "max"}')
    await $.command.run({ command: 'effort-auto', args: 'off', origin: ORIGIN, presentation: { isFullscreen: false, columns: 100 } } as never)
    const file = [...seen.files.entries()].filter(([path]) => path.endsWith('/effort-auto.json')).pop()
    expect(JSON.parse(file![1])).toMatchObject({ isOn: false })

    await $.prompt.submit({ text: 'Write a big report', wait: false, origin: ORIGIN })
    await step($, 0)
    expect(seen.efforts).toEqual(['medium'])
    expect(seen.picks).toBe(0)
  })

  test('slash commands and helper agents are never judged', async ($, on) => {
    const seen = await startSession($, on, '{"level": "low"}')
    await $.prompt.submit({ text: '/clear', wait: false, origin: ORIGIN })
    await step($, 0)
    await $.prompt.submit({ text: 'Plan the launch', wait: false, origin: ORIGIN })
    await step($, 0, 'medium', { agentId: 'helper' })
    expect(seen.picks).toBe(0)
    expect(seen.efforts).toEqual(['medium', 'medium'])
  })

  test('keep and a failed pick leave the level as it was', async ($, on) => {
    const seen = await startSession($, on, '{"level": "keep"}')
    await $.prompt.submit({ text: 'yes, go on', wait: false, origin: ORIGIN })
    await step($, 0)
    expect(seen.efforts).toEqual(['medium'])
  })
})
