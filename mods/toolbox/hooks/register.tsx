// Info: a "✦ Info ▾" button at the right of the prompt footer that
// opens a small panel in the corner above it for the model, effort, the advisor
// and the other mods that are installed. Usage figures and the prompt cache's
// warm or cold belong in Claude Code's own status line setting, not here.
// Colours are theme keys, so they follow Claude Code's theme (custom:omarchy).

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderChildren } from 'claude-code'

import type { AdvisorInfo, ToolboxInfo } from '../types'
import { PASTEL } from './palette'
import { ADVISORS, EFFORTS, MODELS, capitalise, modelAlias, prettyModel } from './text'

const toolboxOpenAtom = atom({ plugin: 'toolbox', key: 'toolboxOpen' } as const, false)
const EMPTY_INFO: ToolboxInfo = { model: '', effort: null }
const toolboxInfoAtom = atom({ plugin: 'toolbox', key: 'toolboxInfo' } as const, EMPTY_INFO)

const EMPTY_ADVISOR: AdvisorInfo = { model: null }
const advisorInfoAtom = atom({ plugin: 'toolbox', key: 'advisorInfo' } as const, EMPTY_ADVISOR)

const LABEL_WIDTH = 8
const INSTALL_HINT = 'Clean View: `/plugin install clean-view --marketplace Rhazi3l/rhazi3l-mods`, Better: `/plugin install prompt-upgrade --marketplace Rhazi3l/rhazi3l-mods`, Deskbar: `/plugin install deskbar --marketplace Rhazi3l/rhazi3l-mods`'

/** A sibling mod the toolbox can switch: it owns its on/off value and a command that takes `on` and `off`. */
type SiblingMod = { id: string; name: string; command: string; description: string }

const CLEAN_VIEW: SiblingMod = {
  id: 'clean-view',
  name: 'Clean View',
  command: 'view',
  description: 'A plain-English checklist above the prompt; Details shows every step and action',
}

const PROMPT_UPGRADE: SiblingMod = {
  id: 'prompt-upgrade',
  name: 'Better',
  command: 'better',
  description: 'A ✦ Better button beside Info that rewrites the prompt you typed; nothing is sent until you press Run it',
}

const DESKBAR: SiblingMod = {
  id: 'deskbar',
  name: 'Deskbar',
  command: 'deskbar',
  description: 'A band above the prompt in the desktop app with the plan, context, 5h and weekly usage and prompt cache',
}

const SIBLINGS = [CLEAN_VIEW, PROMPT_UPGRADE, DESKBAR]

/** Each sibling mod with its on/off, or undefined while it isn't installed. */
async function siblingStates($: EngineInterface): Promise<{ mod: SiblingMod; isOn: boolean | undefined }[]> {
  // Each mod writes its own value; the toolbox only reads them. A mod that isn't installed answers
  // nothing, or refuses the read; either way it is left out and the others still show.
  const cleanViewOn = await $.state.get({ plugin: 'clean-view', key: 'isOn' } as const).then(read => read.value, () => undefined)
  const promptUpgradeOn = await $.state.get({ plugin: 'prompt-upgrade', key: 'isOn' } as const).then(read => read.value, () => undefined)
  const deskbarOn = await $.state.get({ plugin: 'deskbar', key: 'isOn' } as const).then(read => read.value, () => undefined)
  return [
    { mod: CLEAN_VIEW, isOn: cleanViewOn },
    { mod: PROMPT_UPGRADE, isOn: promptUpgradeOn },
    { mod: DESKBAR, isOn: deskbarOn },
  ]
}

async function installedMods($: EngineInterface) {
  return (await siblingStates($)).filter((s): s is { mod: SiblingMod; isOn: boolean } => s.isOn !== undefined)
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

function findMod(query: string): SiblingMod | undefined {
  const wanted = query.trim().toLowerCase().replace(/[\s_]+/g, '-')
  return SIBLINGS.find(mod => mod.id === wanted || mod.name.toLowerCase().replace(/\s+/g, '-') === wanted)
}

async function readAdvisor($: EngineInterface) {
  try {
    const model = await $.settings.read({ key: 'advisorModel' })
    await update($, advisorInfoAtom, now => ({ ...now, model: typeof model === 'string' && model !== '' ? model : null }))
  } catch {
    // Settings can't be read (a headless host).
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    try {
      await $.command.register({
        name: 'mods',
        description: 'List your mods, or switch one on or off',
        argumentHint: '[mod] [on|off]',
        immediate: true,
      })
      await $.command.register({
        name: 'toolbox',
        description: 'Open or close the Info panel: model, effort and mods',
        immediate: true,
      })
    } catch {
      // Not bound (a headless host): the toolbox still follows what it can.
    }

    const started = await next(e)
    await readAdvisor($)
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
    return { text: isOpen ? 'Info open above the prompt.' : 'Info closed.' }
  })

  on('command.run', { command: 'mods' }, async ($, e) => {
    const installed = await installedMods($)
    if (installed.length === 0) {
      return { text: `No mods are installed yet. To add one: ${INSTALL_HINT}` }
    }
    const args = e.args.trim()
    if (args === '') {
      const lines = installed.map(({ mod, isOn }) => `- ${isOn ? '●' : '○'} **${mod.name}**: ${mod.description}`)
      return { text: `Your mods:\n${lines.join('\n')}\n\nUse /mods <name> on or /mods <name> off.` }
    }
    const [, name = args, wanted] = /^(.*?)\s+(on|off)$/i.exec(args) ?? []
    const mod = findMod(name)
    const found = mod && installed.find(s => s.mod.id === mod.id)
    if (!found) return { text: `No mod called "${args}". Type /mods to see them.` }
    const isOn = wanted ? wanted.toLowerCase() === 'on' : !found.isOn
    // A command can't run another while it answers, so the switch runs just after.
    $.clock.after(0, async () => $.ui.toast(await switchMod($, found.mod, isOn)))
    return { text: `Switching ${found.mod.name} ${isOn ? 'on' : 'off'}.` }
  })

  // The footer button, beside the engine's own mode labels.
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const isOpen = await read($, toolboxOpenAtom)
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
            onPress={() => update($, toolboxOpenAtom, open => !open)}
          >
            <Text color={PASTEL.working}>{'✦ '}</Text>
            <Text color={isOpen ? PASTEL.working : 'text'} bold={isOpen}>
              Info
            </Text>
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
    const installed = await installedMods($)
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
          borderStyle="round"
          borderColor={PASTEL.working}
          paddingX={isTerminal ? 1 : 'md'}
          paddingY={isTerminal ? undefined : 'sm'}
          gap={isTerminal ? undefined : 'sm'}
        >
          <Box flexDirection="row" justifyContent="space-between">
            <Box flexGrow={1} flexShrink={1}>
              <Text bold color={PASTEL.working} wrap="truncate-end">
                ✦ Info
              </Text>
            </Box>
            <Box flexShrink={0}>
              <Button
                key="toolbox-close"
                plain
                role="dismiss"
                label="close"
                hotkey="x"
                onPress={() => update($, toolboxOpenAtom, () => false)}
              />
            </Box>
          </Box>
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
                installed.map(({ mod, isOn }) => (
                  <Button
                    key={`mod-${mod.id}`}
                    variant={isOn ? 'primary' : 'secondary'}
                    onPress={async () => {
                      const now = (await installedMods($)).find(s => s.mod.id === mod.id)
                      $.ui.toast(await switchMod($, mod, !(now?.isOn ?? isOn)))
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
