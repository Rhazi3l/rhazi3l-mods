// Prompt Upgrade: the "✦ Better" button above the prompt (or
// `/better <rough prompt>`) rewrites the prompt into a clearer one and shows both
// in a pane. Nothing is sent until the person presses Run it.
// Opt in per prompt, one fast-model call, no history kept.
// Colours are theme keys and layout is boxes that wrap, so it follows the theme
// and draws the same in the terminal and the desktop app.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { UpgradeFlow } from '../types'
import { PASTEL } from './palette'
import { buildRequest, countWords, fillPlaceholders, findPlaceholders, parseUpgrade } from './text'

const PANE = 'prompt-upgrade'
const TITLE = 'Prompt Upgrade'
const STORE_ON = 'isOn'
const NARROW = 70

const IDLE: UpgradeFlow = { phase: 'idle', original: '', upgraded: '', added: [], fills: {}, note: '', runId: 0 }

// Whether the footer button shows. The toolbox switches it; `/better <prompt>` works either way.
const isOnAtom = atom({ plugin: 'prompt-upgrade', key: 'isOn' } as const, true)
const flowAtom = atom({ plugin: 'prompt-upgrade', key: 'flow' } as const, IDLE)

const USAGE =
  'Type your prompt, then press the ✦ Better button above it (or type /better and the prompt). A pane shows the upgrade beside it, and nothing is sent until you press Run it.'

/** Shows the failure card; the person's prompt is still kept. */
async function fail($: EngineInterface, runId: number, note: string) {
  await update($, flowAtom, (flow): UpgradeFlow => (flow.runId === runId ? { ...flow, phase: 'error', note } : flow))
}

async function upgrade($: EngineInterface, original: string) {
  const runId = (await read($, flowAtom)).runId + 1
  await update($, flowAtom, (): UpgradeFlow => ({ ...IDLE, phase: 'working', original, runId }))
  try {
    const opened = await $.ui.open({ id: PANE, title: TITLE })
    if (!opened.isPlaced) {
      await update($, flowAtom, () => ({ ...IDLE, runId }))
      $.ui.toast(`No room for the pane (${opened.reason}). Widen the window and run /better again.`)
      return
    }
    const reply = await $.model.complete(buildRequest(original))
    if (!reply.isAnswered) return fail($, runId, 'The model did not answer.')
    const parsed = parseUpgrade(reply.text)
    if (!parsed) return fail($, runId, 'The answer was not in a form I could read.')
    await update($, flowAtom, (flow): UpgradeFlow =>
      flow.runId === runId ? { ...flow, phase: 'review', upgraded: parsed.upgraded, added: parsed.added, fills: {} } : flow,
    )
  } catch {
    await fail($, runId, 'Something went wrong while upgrading.')
  }
}

/** Closes the pane and clears the flow; a late model answer for it is then ignored. */
async function finish($: EngineInterface) {
  await update($, flowAtom, flow => ({ ...IDLE, runId: flow.runId + 1 }))
  try {
    await $.ui.close({ id: PANE })
  } catch {
    // Already closed.
  }
}

/** Sends `text` as the person's prompt, then closes the pane. */
async function send($: EngineInterface, text: string) {
  const sent = text.trim()
  if (sent === '') return
  try {
    const { original } = await read($, flowAtom)
    await finish($)
    // The draft the upgrade came from would otherwise stay in the box; only clear it if it is still that draft.
    if ((await $.prompt.read()).text.trim() === original.trim()) await $.prompt.fill({ text: '' })
    // As the person's own words, so the model reads it without a "plugin sent a message" frame.
    void $.prompt.submit({ text: sent, asUser: true })
  } catch {
    $.ui.toast("Couldn't send the prompt.")
  }
}

/** Puts `text` in the main prompt box, which is roomier than a field in the pane, and closes the pane. */
async function editInBox($: EngineInterface, text: string) {
  try {
    const filled = await $.prompt.fill({ text })
    if (!filled.isFilled) return $.ui.toast("Couldn't put it in the prompt box.")
    await finish($)
  } catch {
    $.ui.toast("Couldn't put it in the prompt box.")
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const saved = await $.store.get(STORE_ON)
    // Written even when unchanged, so the toolbox can tell Prompt Upgrade is installed.
    await update($, isOnAtom, () => (typeof saved === 'boolean' ? saved : true))
    try {
      await $.command.register({
        name: 'better',
        description: 'Upgrade a rough prompt before sending it',
        argumentHint: '<rough prompt> | on | off',
        immediate: true,
      })
    } catch {
      // Not bound (a headless host): the mod still follows what it can.
    }
    return next(e)
  })

  on('command.run', { command: 'better' }, async ($, e) => {
    const args = e.args.trim()
    // `on` and `off` are the toolbox's switch for the footer button, so they are never taken as a prompt.
    if (args.toLowerCase() === 'on' || args.toLowerCase() === 'off') {
      const turnsOn = args.toLowerCase() === 'on'
      await update($, isOnAtom, () => turnsOn)
      await $.store.set(STORE_ON, turnsOn)
      return { text: `The Better button is ${turnsOn ? 'on' : 'off'}.` }
    }
    if (args === '') return { text: USAGE }
    // A command answers at once; the pane and the model call follow in the background.
    $.clock.after(0, () => {
      void upgrade($, args)
    })
    return { text: 'Upgrading your prompt. The pane shows it when it is ready.' }
  })

  // The footer button, to the left of the toolbox's (which draws whatever this returns): upgrades what is typed in the box.
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const rest = await next(e)
    if (!(await read($, isOnAtom))) return rest
    const { Box, Text, Button } = $.ui.resolve(e)
    // The footer has little room beside the Info button, and the desktop app clips what does
    // not fit at the right, so the label stays short.
    return (
      <Box flexDirection="row">
        <Box key="pu-footer" marginRight={1} flexShrink={0}>
          <Button
            key="pu-upgrade"
            plain
            onPress={async () => {
              try {
                const draft = (await $.prompt.read()).text.trim()
                if (draft === '') return $.ui.toast('Type a prompt first, then press Better.')
                void upgrade($, draft)
              } catch {
                $.ui.toast("Couldn't read your prompt.")
              }
            }}
          >
            <Text color={PASTEL.working}>{'✦ '}</Text>
            <Text>Better</Text>
          </Button>
        </Box>
        {rest}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const ui = $.ui.resolve(e)
    const { Box, Text, Button } = ui
    // The mobile app draws no text field yet, so there the blanks cannot be filled in the pane.
    const Input = 'Input' in ui ? ui.Input : undefined
    const flow = await read($, flowAtom)
    const isNarrow = (e.props.bodyColumns ?? 80) < NARROW

    const heading = (text: string) => (
      <Text bold color={PASTEL.working}>
        {text}
      </Text>
    )
    const card = (key: string, title: string, body: string, color: string) => (
      <Box
        key={key}
        flexDirection="column"
        borderStyle="round"
        borderColor={color}
        paddingX={1}
        flexGrow={1}
        flexShrink={1}
        minWidth={isNarrow ? undefined : 24}
      >
        <Text dimColor>{title}</Text>
        <Text wrap="wrap">{body}</Text>
      </Box>
    )
    const cancel = (
      <Button key="pu-cancel" plain role="dismiss" label="Cancel" hotkey="x" onPress={() => finish($)} />
    )

    if (flow.phase === 'idle') {
      return (
        <Box flexDirection="column">
          <Text dimColor wrap="wrap">
            {USAGE}
          </Text>
        </Box>
      )
    }

    if (flow.phase === 'working') {
      return (
        <Box flexDirection="column" gap={1}>
          {heading('Rewriting your prompt')}
          {card('pu-original', 'YOUR PROMPT', flow.original, PASTEL.stopped)}
          <Box flexDirection="row" flexWrap="wrap">
            {cancel}
          </Box>
        </Box>
      )
    }

    if (flow.phase === 'error') {
      return (
        <Box flexDirection="column" gap={1}>
          <Box key="pu-error" flexDirection="column" borderStyle="round" borderColor={PASTEL.stuck} paddingX={1}>
            <Text color={PASTEL.stuck} bold>
              Your prompt is safe.
            </Text>
            <Text wrap="wrap">{flow.note}</Text>
          </Box>
          {card('pu-original', 'YOUR PROMPT', flow.original, PASTEL.stopped)}
          <Box flexDirection="row" flexWrap="wrap" gap={1}>
            <Button key="pu-retry" label="Try again" variant="primary" hotkey="t" onPress={() => upgrade($, flow.original)} />
            <Button key="pu-send-original" label="Send my original" onPress={() => send($, flow.original)} />
            {cancel}
          </Box>
        </Box>
      )
    }

    // The rewrite with the blanks the person has filled in; what Run it sends, Copy copies and the card shows.
    const text = fillPlaceholders(flow.upgraded, flow.fills)
    const blanks = findPlaceholders(flow.upgraded)
    const filledCount = blanks.filter(name => (flow.fills[name] ?? '').trim() !== '').length
    const before = countWords(flow.original)
    const after = countWords(text)
    const details = `${flow.added.length} detail${flow.added.length === 1 ? '' : 's'} added`
    const left = blanks.length === 0 ? '' : ` · ${filledCount} of ${blanks.length} blank${blanks.length === 1 ? '' : 's'} filled`

    return (
      <Box flexDirection="column" gap={1}>
        <Text key="pu-numbers" dimColor>{`${before} words → ${after} words · ${details}${left}`}</Text>
        <Box flexDirection="row" flexWrap="wrap" gap={1}>
          <Button key="pu-run" label="Run it" variant="primary" hotkey="r" onPress={() => send($, text)} />
          <Button key="pu-edit" label="Edit in prompt box" hotkey="e" onPress={() => editInBox($, text)} />
          <Button
            key="pu-copy"
            label="Copy"
            hotkey="c"
            onPress={async press => {
              try {
                const copied = await $.ui.copy({ text, surface: press.surface })
                if (!copied.isCopied) $.ui.toast("Couldn't copy here.")
              } catch {
                $.ui.toast("Couldn't copy here.")
              }
            }}
          />
          {cancel}
        </Box>
        {flow.added.length > 0 && (
          <Box key="pu-added" flexDirection="column">
            <Text dimColor>WHAT I ADDED</Text>
            {flow.added.map((item, i) => (
              <Text key={`added-${i}`} wrap="wrap">{`+ ${item}`}</Text>
            ))}
          </Box>
        )}
        {Input && blanks.length > 0 && (
          <Box key="pu-blanks" flexDirection="column">
            <Text dimColor>FILL IN THE BLANKS</Text>
            {blanks.map((name, i) => (
              <Input
                key={`pu-fill-${i}`}
                label={`${name}: `}
                placeholder="type what goes here"
                value={flow.fills[name] ?? ''}
                submitLabel="next"
                onInput={value => void update($, flowAtom, now => ({ ...now, fills: { ...now.fills, [name]: value } }))}
                onSubmit={() => undefined}
              />
            ))}
          </Box>
        )}
        <Box flexDirection={isNarrow ? 'column' : 'row'} gap={1}>
          {card('pu-original', 'YOUR PROMPT', flow.original, PASTEL.stopped)}
          {card('pu-upgraded', 'THE UPGRADE', text, PASTEL.working)}
        </Box>
      </Box>
    )
  })
}
