// Info: a "✦ Info ▾" button at the right of the prompt footer that
// opens a small panel in the corner above it for the model, effort, the advisor
// and the other mods that are installed. On the desktop the button also carries how full the context is
// (the terminal's status line has that).
// Usage figures and the prompt cache belong in Claude Code's own status line setting, not here.
// Colours are the mods' shared palette (palette.ts).

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderChildren } from 'claude-code'

import type { AdvisorInfo, ToolboxInfo, ToolboxMod } from '../types'
import { PASTEL } from './palette'
import type { ModEntry } from './registry'
import { ADVISORS, EFFORTS, MODELS, capitalise, contextColor, modelAlias, prettyModel } from './text'

const toolboxOpenAtom = atom({ plugin: 'toolbox', key: 'toolboxOpen' } as const, false)
const EMPTY_INFO: ToolboxInfo = { model: '', effort: null }
const toolboxInfoAtom = atom({ plugin: 'toolbox', key: 'toolboxInfo' } as const, EMPTY_INFO)

const EMPTY_ADVISOR: AdvisorInfo = { model: null }
const advisorInfoAtom = atom({ plugin: 'toolbox', key: 'advisorInfo' } as const, EMPTY_ADVISOR)

const EMPTY_MODS: ToolboxMod[] = []
const modsAtom = atom({ plugin: 'toolbox', key: 'mods' } as const, EMPTY_MODS)

const contextAtom = atom({ plugin: 'toolbox', key: 'contextPercent' } as const, null as number | null)

const LABEL_WIDTH = 8
/** A mod the toolbox can switch: it has an on/off and a slash command that takes `on` and `off`. */
type SiblingMod = ModEntry

/**
 * Every installed mod that has published an on/off. Each such mod writes a file to the mods' switchboard
 * (registry.ts), so a mod appears here when it is installed and goes when it is removed, with nothing
 * added to or taken out of the toolbox. The installed-plugins list is the check that a file left behind
 * by a removed mod is not shown.
 */
async function installedMods($: EngineInterface): Promise<{ mod: SiblingMod; isOn: boolean }[]> {
  try {
    const dotClaude = `${$.plugin.root.split('/.claude/')[0] ?? ''}/.claude`
    const dir = `${dotClaude}/mods-registry`
    if (!(await $.fs.exists(dir))) return []
    const installed = JSON.parse(String(await $.fs.read(`${dotClaude}/plugins/installed_plugins.json`))) as { plugins?: Record<string, unknown> }
    const names = new Set(Object.keys(installed.plugins ?? {}).map(key => key.split('@')[0]))
    const found: { mod: SiblingMod; isOn: boolean }[] = []
    for (const file of await $.fs.list(dir)) {
      if (file.kind !== 'file' || !file.name.endsWith('.json')) continue
      try {
        const entry = JSON.parse(String(await $.fs.read(`${dir}/${file.name}`))) as Partial<ModEntry> & { isOn?: unknown }
        const { id, name, command, description } = entry
        if (typeof id !== 'string' || typeof name !== 'string' || typeof command !== 'string' || typeof entry.isOn !== 'boolean') continue
        if (id === 'toolbox' || !names.has(id)) continue
        found.push({ mod: { id, name, command, description: typeof description === 'string' ? description : '' }, isOn: entry.isOn })
      } catch {
        // One unreadable file leaves out that mod only.
      }
    }
    return found.sort((x, y) => x.mod.name.localeCompare(y.mod.name))
  } catch {
    return []
  }
}

/** The level Auto Effort holds for the chat, or null when it is off or holding none. */
async function autoEffort($: EngineInterface): Promise<string | null> {
  try {
    const file = `${$.plugin.root.split('/.claude/')[0] ?? ''}/.claude/mods-registry/effort-auto.json`
    const entry = JSON.parse(String(await $.fs.read(file))) as { isOn?: unknown; effort?: unknown }
    return entry.isOn === true && typeof entry.effort === 'string' ? entry.effort : null
  } catch {
    return null
  }
}

/** Runs the mod's own command, so the mod keeps its value and saves it. */
async function switchMod($: EngineInterface, mod: SiblingMod, isOn: boolean): Promise<string> {
  try {
    await $.command.run({ command: mod.command, args: isOn ? 'on' : 'off' })
    return `${mod.name} is ${isOn ? 'on' : 'off'}.`
  } catch {
    return `Couldn't switch ${mod.name} ${isOn ? 'on' : 'off'}.`
  }
}

async function readAdvisor($: EngineInterface) {
  try {
    const model = await $.settings.read({ key: 'advisorModel' })
    await update($, advisorInfoAtom, now => ({ ...now, model: typeof model === 'string' && model !== '' ? model : null }))
  } catch {
    // Settings can't be read (a headless host).
  }
}

/** The level Auto Effort held when the panel last looked, so only a change by Auto Effort moves the Effort row. */
let lastAuto: string | null = null

/**
 * Looks at what the panel shows that no event of its own announces: the level Auto Effort holds, the
 * session's model, the advisor and the mods' on/off. Runs when the panel opens and after every command
 * (a command is what changes any of them). Each update writes only on a real change, so nothing redraws
 * needlessly.
 */
async function refresh($: EngineInterface) {
  try {
    const auto = await autoEffort($)
    // Auto Effort letting go needs no look here: it sets the picker back with /effort, which sets the row.
    if (auto !== lastAuto) {
      lastAuto = auto
      if (auto !== null) if ((await read($, toolboxInfoAtom)).effort !== auto) await update($, toolboxInfoAtom, now => ({ ...now, effort: auto }))
    }
  } catch {
    // The next command looks again.
  }
  try {
    const model = await $.session.model()
    if ((await read($, toolboxInfoAtom)).model !== model) await update($, toolboxInfoAtom, now => ({ ...now, model }))
  } catch {
    // No session to read.
  }
  try {
    const advisor = await $.settings.read({ key: 'advisorModel' })
    const next = typeof advisor === 'string' && advisor !== '' ? advisor : null
    if ((await read($, advisorInfoAtom)).model !== next) await update($, advisorInfoAtom, now => ({ ...now, model: next }))
  } catch {
    // Settings can't be read.
  }
  try {
    const found = (await installedMods($)).map(({ mod, isOn }) => ({ ...mod, isOn }))
    const key = JSON.stringify(found)
    if (JSON.stringify(await read($, modsAtom)) !== key) await update($, modsAtom, () => found)
  } catch {
    // The next command looks again.
  }
}

/** Opens or closes the panel; opening looks at everything first, so it never shows old values. */
async function toggle($: EngineInterface): Promise<boolean> {
  if (!(await read($, toolboxOpenAtom))) await refresh($)
  return update($, toolboxOpenAtom, open => !open)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    try {
      await $.command.register({
        name: 'toolbox',
        description: 'Open or close the Info panel: model, effort, advisor and mods',
        immediate: true,
      })
    } catch {
      // Not bound (a headless host): the toolbox still follows what it can.
    }

    const started = await next(e)
    await readAdvisor($)
    try {
      const { context } = await $.session.usage()
      await update($, contextAtom, () => context.percent ?? null)
    } catch {
      // No session to read (a headless host): the figure shows once a measurement arrives.
    }
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

  // The model and effort each main-loop request really goes out with. Auto Effort sets its level on the
  // request itself, so the level it holds (from its switchboard file) is the real one, and is read again
  // once the step is done because it picks during the turn's first.
  on('turn.step', async function* ($, e, next) {
    const track = async () => {
      if (e.agentId !== undefined) return
      const effort = (await autoEffort($)) ?? (e.effort === undefined ? null : String(e.effort))
      const info = await read($, toolboxInfoAtom)
      if (info.model !== e.model || info.effort !== effort) {
        await update($, toolboxInfoAtom, now => ({ ...now, model: e.model, effort }))
      }
    }
    await track()
    const result = yield* next(e)
    await track().catch(() => undefined)
    return result
  })

  // Any command can change what the panel shows (/effort, /model, /advisor, a mod's on and off, the
  // mod's own reset of the picker), so after each one the panel looks again. A command that sets the effort
  // is read from its own words: the saved settings may not have caught up yet.
  on('command.run', async ($, e, next) => {
    const result = await next(e)
    if (e.command === 'toolbox') return result
    try {
      if (e.command === 'effort') {
        const level = e.args.trim().toLowerCase().replace(/[^a-z]/g, '')
        const named = level === 'extrahigh' ? 'xhigh' : level
        if ((EFFORTS as readonly string[]).includes(named)) {
          if ((await read($, toolboxInfoAtom)).effort !== named) await update($, toolboxInfoAtom, now => ({ ...now, effort: named }))
        }
      }
      // Auto Effort let go: the requests are back at the picker's level, so the row shows that level.
      if (e.command === 'effort-auto' && (await autoEffort($)) === null) {
        const saved = (await $.settings.read()).effortLevel
        if (typeof saved === 'string' && (await read($, toolboxInfoAtom)).effort !== saved) {
          await update($, toolboxInfoAtom, now => ({ ...now, effort: saved }))
        }
      }
      if (await read($, toolboxOpenAtom)) await refresh($)
    } catch {
      // The panel keeps what it showed.
    }
    return result
  })

  // How full the context window is, for the figure beside the Info button.
  on('session.measure', async ($, e, next) => {
    await update($, contextAtom, () => e.context.percent ?? null)
    return next(e)
  })

  on('command.run', { command: 'toolbox' }, async $ => {
    const isOpen = await toggle($)
    return { text: isOpen ? 'Info open above the prompt.' : 'Info closed.' }
  })

  // The footer button, beside the engine's own mode labels.
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const isOpen = await read($, toolboxOpenAtom)
    const context = await read($, contextAtom)
    const modes = e.props.modes.join(' & ')
    // The desktop footer has little room, so there the chevron is dropped.
    const isTerminal = e.surface === 'terminal'
    // Other mods' footer buttons (Better's) draw to the left of this one. The modes are
    // drawn here, so the rest of the chain gets none and they are not drawn twice.
    const others = await next({ ...e, props: { ...e.props, modes: [] } })

    return (
      <Box flexDirection="row">
        {modes !== '' && <Text dimColor>{`${modes}  `}</Text>}
        {others}
        <Box key="toolbox-footer" flexShrink={0}>
          <Button
            key="toolbox"
            plain
            onPress={() => toggle($)}
          >
            <Text color={PASTEL.working}>{'✦ '}</Text>
            <Text color={isOpen ? PASTEL.working : 'text'} bold={isOpen}>
              Info
            </Text>
            {!isTerminal && context !== null && (
              <Text dimColor={context < 80} color={context < 80 ? undefined : contextColor(context)}>{` ${Math.floor(context)}%`}</Text>
            )}
            {isTerminal && <Text color={isOpen ? PASTEL.working : PASTEL.stopped}>{isOpen ? ' ▴' : ' ▾'}</Text>}
          </Button>
        </Box>
      </Box>
    )
  })

  // The toolbox panel, under whatever other mods draw above the prompt.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const below = await next(e)
    if (!(await read($, toolboxOpenAtom))) return below

    const { Box, Text, Button } = $.ui.resolve(e)
    const info = await read($, toolboxInfoAtom)
    const installed = await read($, modsAtom)
    const currentModel = modelAlias(info.model)
    const advisor = await read($, advisorInfoAtom)
    const currentAdvisor = advisor.model ? modelAlias(advisor.model) : null
    // Laid out by boxes, not padded text: the desktop app draws a wider font and
    // native buttons, so its rows wrap instead of running into each other.
    const label = (text: string) => (
      <Box width={LABEL_WIDTH} flexShrink={0}>
        <Text dimColor>{text}</Text>
      </Box>
    )
    const setAdvisor = async (choice: string) => {
      try {
        await $.command.run({ command: 'advisor', args: choice })
        await readAdvisor($)
        // Settings may not have caught up yet; show the choice meanwhile.
        await update($, advisorInfoAtom, now => ({ ...now, model: choice === 'off' ? null : now.model ?? choice }))
      } catch {
        $.ui.toast(`Couldn't set the advisor to ${choice}.`)
      }
    }
    // The desktop app draws its buttons with a hairline between them and its rows touching, so there
    // each gets room; the terminal draws what is written, brackets and all.
    const isTerminal = e.surface === 'terminal'
    // The desktop app has its own model and effort pickers, so the panel leaves those two rows to it.
    const showsModelAndEffort = e.surface !== 'desktop'
    const buttons = (children: RenderChildren) => (
      <Box flexDirection="row" flexWrap="wrap" flexShrink={1} columnGap={isTerminal ? undefined : 'sm'} rowGap={isTerminal ? undefined : 'sm'}>
        {children}
      </Box>
    )

    return (
      <Box flexDirection="column">
        {below}
        <Box
          key="toolbox-panel"
          alignSelf="flex-end"
          flexDirection="column"
          marginTop={isTerminal ? undefined : 'sm'}
          borderStyle="round"
          borderColor={PASTEL.working}
          paddingX={isTerminal ? 1 : 'md'}
          paddingY={isTerminal ? undefined : 'md'}
          gap={isTerminal ? undefined : 'sm'}
        >
          {showsModelAndEffort && (
            <Box key="toolbox-model" flexDirection="row">
              {label('Model')}
              {buttons([
                ...MODELS.map(alias => (
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
                )),
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
                />,
              ])}
            </Box>
          )}
          {showsModelAndEffort && (
            <Box key="toolbox-effort" flexDirection="row">
              {label('Effort')}
              {buttons(
                EFFORTS.map(level => (
                  <Button
                    key={`effort-${level}`}
                    label={capitalise(level)}
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
                )),
              )}
            </Box>
          )}
          <Box key="toolbox-advisor" flexDirection="row">
            {label('Advisor')}
            {buttons([
              ...ADVISORS.map(alias => (
                <Button
                  key={`advisor-${alias}`}
                  label={prettyModel(alias)}
                  variant={alias === currentAdvisor ? 'primary' : 'secondary'}
                  onPress={() => setAdvisor(alias)}
                />
              )),
              <Button
                key="advisor-off"
                label="Off"
                variant={advisor.model === null ? 'primary' : 'secondary'}
                onPress={() => setAdvisor('off')}
              />,
            ])}
          </Box>
          {installed.length > 0 && (
            <Box key="toolbox-mods" flexDirection="row">
              {label('Mods')}
              {buttons(
                installed.map(({ isOn, ...mod }) => (
                  <Button
                    key={`mod-${mod.id}`}
                    variant="secondary"
                    onPress={async () => {
                      const now = (await installedMods($)).find(s => s.mod.id === mod.id)
                      $.ui.toast(await switchMod($, mod, !(now?.isOn ?? isOn)))
                      await refresh($)
                    }}
                  >
                    <Text color={isOn ? PASTEL.done : PASTEL.stopped}>{isOn ? '●' : '○'}</Text>
                    {` ${mod.name}`}
                  </Button>
                )),
              )}
            </Box>
          )}
        </Box>
      </Box>
    )
  })
}
