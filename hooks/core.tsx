// The pack's core: start-up for every mod (saved choices, tools, commands),
// /mods, and the toolbox: a "◆ toolbox ▾" button at the right of the prompt footer
// that opens a small panel in the corner above it for the model, effort and mods.
// Usage lives in the status line (statusline/statusline.sh), not here.
// Colours are theme keys, so they follow Claude Code's theme (custom:omarchy).

import { atom, read, update } from 'claude-code'
import type { On } from 'claude-code'

import type { ToolboxInfo } from '../types'
import { MODS, isModOn } from './catalog'
import { STORE_ENABLED, STORE_SETTINGS, onlyValues } from './pack'
import { EFFORTS, MODELS, modelAlias, prettyModel } from './toolbox/text'

// The pack's shared values (types/index.d.ts): which mods are on, and their settings.
const enabledModsAtom = atom({ plugin: 'rhazi3l-mods', key: 'enabledMods' } as const, {})
const modSettingsAtom = atom({ plugin: 'rhazi3l-mods', key: 'modSettings' } as const, {})
const toolboxOpenAtom = atom({ plugin: 'rhazi3l-mods', key: 'toolboxOpen' } as const, false)
const EMPTY_INFO: ToolboxInfo = { model: '', effort: null }
const toolboxInfoAtom = atom({ plugin: 'rhazi3l-mods', key: 'toolboxInfo' } as const, EMPTY_INFO)

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean'
const isString = (value: unknown): value is string => typeof value === 'string'

const LABEL_WIDTH = 8

function findMod(query: string) {
  const wanted = query.trim().toLowerCase().replace(/[\s_]+/g, '-')
  return MODS.find(mod => mod.id === wanted || mod.name.toLowerCase().replace(/\s+/g, '-') === wanted)
}

export function registerCore(on: On) {
  on('session.start', async ($, e, next) => {
    const enabled = onlyValues(await $.store.get(STORE_ENABLED), isBoolean)
    const settings = onlyValues(await $.store.get(STORE_SETTINGS), isString)
    await update($, enabledModsAtom, () => enabled)
    await update($, modSettingsAtom, () => settings)

    try {
      await $.command.register({
        name: 'mods',
        description: 'List your mods, or switch one on or off',
        argumentHint: '[mod] [on|off]',
        immediate: true,
      })
      await $.command.register({
        name: 'toolbox',
        description: 'Open or close the toolbox: model, effort and mods',
        immediate: true,
      })
      for (const mod of MODS) {
        for (const tool of mod.tools ?? []) await $.tool.register(tool)
        for (const command of mod.commands ?? []) await $.command.register(command)
      }
    } catch {
      // Not bound (a headless host): the mods still follow what they can.
    }

    const started = await next(e)
    try {
      const model = await $.session.model()
      const saved = (await $.settings.read()).effortLevel
      await update($, toolboxInfoAtom, info => ({
        ...info,
        model,
        effort: info.effort ?? (typeof saved === 'string' ? saved : null),
      }))
    } catch {
      // No session to read (a headless host): the toolbox shows what it learns later.
    }
    return started
  })

  // The model and effort each main-loop request really goes out with.
  on('turn.step', async function* ($, e, next) {
    if (e.agentId === undefined) {
      const effort = e.effort === undefined ? null : String(e.effort)
      const info = await read($, toolboxInfoAtom)
      if (info.model !== e.model || info.effort !== effort) {
        await update($, toolboxInfoAtom, now => ({ ...now, model: e.model, effort }))
      }
    }
    return yield* next(e)
  })

  on('command.run', { command: 'toolbox' }, async $ => {
    const isOpen = await update($, toolboxOpenAtom, open => !open)
    return { text: isOpen ? 'Toolbox open above the prompt.' : 'Toolbox closed.' }
  })

  on('command.run', { command: 'mods' }, async ($, e) => {
    const enabled = await read($, enabledModsAtom)
    const args = e.args.trim()
    if (args === '') {
      const lines = MODS.map(mod => `- ${isModOn(enabled, mod.id) ? '●' : '○'} **${mod.name}**: ${mod.description}`)
      return { text: `Your mods:\n${lines.join('\n')}\n\nUse /mods <name> on or /mods <name> off.` }
    }
    const [, name = args, wanted] = /^(.*?)\s+(on|off)$/i.exec(args) ?? []
    const mod = findMod(name)
    if (!mod) return { text: `No mod called "${args}". Type /mods to see them.` }
    const isOn = wanted ? wanted.toLowerCase() === 'on' : !isModOn(enabled, mod.id)
    const written = await update($, enabledModsAtom, map => ({ ...map, [mod.id]: isOn }))
    await $.store.set(STORE_ENABLED, written)
    return { text: `${mod.name} is ${isOn ? 'on' : 'off'}.` }
  })

  // The footer button, beside the engine's own mode labels.
  on('ui.render', { component: 'SessionMode' }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const isOpen = await read($, toolboxOpenAtom)
    const modes = e.props.modes.join(' & ')

    return (
      <Box flexDirection="row">
        {modes !== '' && <Text dimColor>{`${modes}  `}</Text>}
        <Button
          key="toolbox"
          plain
          onPress={() => update($, toolboxOpenAtom, open => !open)}
        >
          <Text color="claude">{'◆ '}</Text>
          <Text color={isOpen ? 'claude' : 'text'} bold={isOpen}>
            toolbox
          </Text>
          <Text color={isOpen ? 'claude' : 'inactive'}>{isOpen ? ' ▴' : ' ▾'}</Text>
        </Button>
      </Box>
    )
  })

  // The toolbox panel, under whatever the mods draw above the prompt.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const below = await next(e)
    if (!(await read($, toolboxOpenAtom))) return below

    const { Box, Text, Button } = $.ui.resolve(e)
    const enabled = await read($, enabledModsAtom)
    const info = await read($, toolboxInfoAtom)
    const currentModel = modelAlias(info.model)
    const label = (text: string) => <Text dimColor>{text.padEnd(LABEL_WIDTH)}</Text>

    return (
      <Box flexDirection="column">
        {below}
        <Box
          key="toolbox-panel"
          alignSelf="flex-end"
          flexDirection="column"
          borderStyle="round"
          borderColor="promptBorder"
          paddingX={1}
        >
          <Box flexDirection="row" justifyContent="space-between">
            <Text bold color="claude">◆ toolbox</Text>
            <Button
              key="toolbox-close"
              plain
              role="dismiss"
              label="close"
              hotkey="x"
              onPress={() => update($, toolboxOpenAtom, () => false)}
            />
          </Box>
          <Box flexDirection="row" flexWrap="wrap">
            {label('Model')}
            {MODELS.map(alias => (
              <Button
                key={`model-${alias}`}
                label={prettyModel(alias)}
                variant={alias === currentModel ? 'primary' : 'secondary'}
                onPress={async () => {
                  try {
                    await $.command.run({ command: 'model', args: alias })
                    const model = await $.session.model()
                    await update($, toolboxInfoAtom, now => ({ ...now, model }))
                  } catch {
                    $.ui.toast(`Couldn't switch to ${prettyModel(alias)}.`)
                  }
                }}
              />
            ))}
            <Button
              key="model-more"
              label="More…"
              onPress={async () => {
                try {
                  await $.command.run({ command: 'model' })
                } catch {
                  $.ui.toast("Couldn't open the model picker.")
                }
              }}
            />
          </Box>
          <Box flexDirection="row" flexWrap="wrap">
            {label('Effort')}
            {EFFORTS.map(level => (
              <Button
                key={`effort-${level}`}
                label={level}
                variant={level === info.effort ? 'primary' : 'secondary'}
                onPress={async () => {
                  try {
                    await $.command.run({ command: 'effort', args: level })
                    await update($, toolboxInfoAtom, now => ({ ...now, effort: level }))
                  } catch {
                    $.ui.toast(`Couldn't set effort to ${level}.`)
                  }
                }}
              />
            ))}
          </Box>
          <Box flexDirection="row" flexWrap="wrap">
            {label('Mods')}
            {MODS.map(mod => {
              const isOn = isModOn(enabled, mod.id)
              return (
                <Button
                  key={`mod-${mod.id}`}
                  variant={isOn ? 'primary' : 'secondary'}
                  onPress={async () => {
                    const turnsOn = !isModOn(await read($, enabledModsAtom), mod.id)
                    const written = await update($, enabledModsAtom, map => ({ ...map, [mod.id]: turnsOn }))
                    await $.store.set(STORE_ENABLED, written)
                    $.ui.toast(`${mod.name} is ${turnsOn ? 'on' : 'off'}.`)
                  }}
                >
                  <Text color={isOn ? 'success' : 'inactive'}>{isOn ? '●' : '○'}</Text>
                  {` ${mod.name}`}
                </Button>
              )
            })}
          </Box>
        </Box>
      </Box>
    )
  })
}
