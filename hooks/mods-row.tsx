// The pack's core: start-up for every mod (saved choices, tools, commands),
// the Mods row above the prompt with one on/off button per mod, and /mods.

import { atom, read, update } from 'claude-code'
import type { On } from 'claude-code'

import { MODS, isModOn } from './catalog'
import { STORE_ENABLED, STORE_SETTINGS, onlyValues } from './pack'

// The pack's shared values (types/index.d.ts): which mods are on, and their settings.
const enabledModsAtom = atom({ plugin: 'rhazi3l-mods', key: 'enabledMods' } as const, {})
const modSettingsAtom = atom({ plugin: 'rhazi3l-mods', key: 'modSettings' } as const, {})

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean'
const isString = (value: unknown): value is string => typeof value === 'string'

function findMod(query: string) {
  const wanted = query.trim().toLowerCase().replace(/[\s_]+/g, '-')
  return MODS.find(mod => mod.id === wanted || mod.name.toLowerCase().replace(/\s+/g, '-') === wanted)
}

export function registerModsRow(on: On) {
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
      for (const mod of MODS) {
        for (const tool of mod.tools ?? []) await $.tool.register(tool)
        for (const command of mod.commands ?? []) await $.command.register(command)
      }
    } catch {
      // Not bound (a headless host): the mods still follow what they can.
    }
    return next(e)
  })

  on('command.run', { command: 'mods' }, async ($, e) => {
    const enabled = await read($, enabledModsAtom)
    const args = e.args.trim()
    if (args === '') {
      const lines = MODS.map(mod => `- ${isModOn(enabled, mod.id) ? '●' : '○'} **${mod.name}**: ${mod.description}`)
      return { text: `Your mods:\n${lines.join('\n')}\n\nUse /mods <name> on or /mods <name> off.` }
    }
    const match = /^(.*?)\s+(on|off)$/i.exec(args)
    const mod = findMod(match ? match[1] : args)
    if (!mod) return { text: `No mod called "${args}". Type /mods to see them.` }
    const isOn = match ? match[2].toLowerCase() === 'on' : !isModOn(enabled, mod.id)
    const written = await update($, enabledModsAtom, map => ({ ...map, [mod.id]: isOn }))
    await $.store.set(STORE_ENABLED, written)
    return { text: `${mod.name} is ${isOn ? 'on' : 'off'}.` }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const below = await next(e)
    const enabled = await read($, enabledModsAtom)
    const { Box, Text, Button } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        {below}
        <Box key="mods-row" flexDirection="row" justifyContent="flex-end">
          <Text dimColor>{'Mods '}</Text>
          {MODS.map(mod => {
            const isOn = isModOn(enabled, mod.id)
            return (
              <Button
                key={`mod-${mod.id}`}
                label={`${isOn ? '●' : '○'} ${mod.name}`}
                variant={isOn ? 'primary' : 'secondary'}
                onPress={async () => {
                  const turnsOn = !isModOn(await read($, enabledModsAtom), mod.id)
                  const written = await update($, enabledModsAtom, map => ({ ...map, [mod.id]: turnsOn }))
                  await $.store.set(STORE_ENABLED, written)
                  $.ui.toast(`${mod.name} is ${turnsOn ? 'on' : 'off'}.`)
                }}
              />
            )
          })}
        </Box>
      </Box>
    )
  })
}
