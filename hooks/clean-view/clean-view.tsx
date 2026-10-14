// Clean View: a calm checklist above the prompt and, in Guided view, one
// plain line per action in place of the technical tool rows.
//
// Views: Simple hides every tool row, Guided swaps each for a one-line
// summary, Full (Clean View off) leaves Claude Code as it is.

import { atom, derive, read, update } from 'claude-code'
import type { On, Timer } from 'claude-code'

import type { Checklist, ChecklistAction, ChecklistTask, CleanViewStyle, ViewMode } from '../../types'
import { isModOn } from '../catalog'
import { STORE_ENABLED, STORE_SETTINGS } from '../pack'
import { STYLE_SETTING } from './info'
import {
  apiErrorSentence,
  cleanName,
  describeAction,
  formatDuration,
  isUserRefusal,
  MAX_NAME,
  trimToWidth,
} from './text'

const OWN_PREFIX = 'mcp__rhazi3l-mods__'
const PLAN_TOOL = 'mcp__rhazi3l-mods__plan_steps'
const PROGRESS_TOOL = 'mcp__rhazi3l-mods__report_progress'

const ALWAYS_ALLOWED = new Set(['ToolSearch', 'TodoWrite', 'TaskCreate', 'TaskUpdate', 'AskUserQuestion'])
const STYLES: readonly CleanViewStyle[] = ['guided', 'simple']
const METER = 10
const TICK_MS = 250
const COLLAPSE_MS = 5000
const MAX_ACTIONS = 20
const FAILS_BEFORE_STUCK = 3

const REASON_PERMISSION = 'Claude needs your OK to continue'
const REASON_QUESTION = 'Claude has a question for you'
const REASON_REPLY = 'Claude is waiting for your reply'
const STUCK_REFUSED = 'you said no to a step, so Claude paused'
const STUCK_FAILING = 'a step keeps failing, Claude is trying another way'
const STUCK_REFUSAL = "Claude couldn't help with that request"

const EMPTY: Checklist = {
  title: '',
  phase: 'idle',
  tasks: [],
  needsYouReason: null,
  stuckReason: null,
  startedAt: null,
  finishedAt: null,
  isCollapsed: false,
  hasRealPlan: false,
  jobId: 0,
  actions: [],
}

// The pack's shared values (types/index.d.ts): which mods are on, and their settings.
const enabledModsAtom = atom({ plugin: 'rhazi3l-mods', key: 'enabledMods' } as const, {})
const modSettingsAtom = atom({ plugin: 'rhazi3l-mods', key: 'modSettings' } as const, {})
const checklistAtom = atom({ plugin: 'rhazi3l-mods', key: 'checklist' } as const, EMPTY)
const tickAtom = atom({ plugin: 'rhazi3l-mods', key: 'tick' } as const, 0)

/** The style the person picked (Guided unless they chose Simple). */
const styleAtom = derive([modSettingsAtom], (settings): CleanViewStyle =>
  settings[STYLE_SETTING] === 'simple' ? 'simple' : 'guided',
)

/** The view in force: the picked style, or `full` while the Mods row has Clean View off. */
const modeAtom = derive([styleAtom, enabledModsAtom], (style, mods): ViewMode =>
  isModOn(mods, 'clean-view') ? style : 'full',
)

const PROMPT_SECTION = `# Clean View checklist
The person sees a plain-English checklist of your work instead of tool output.
- For every request, even a quick question, call ${PLAN_TOOL} first with every step of the job in order (2 to 8 steps). If it is deferred, load it with ToolSearch first. If this session has TodoWrite or TaskCreate, your to-do list can serve as the plan instead.
- Then call ${PROGRESS_TOOL} as real progress happens, and with percent 100 the moment a step finishes.
- Write every step name in plain English a non-technical person understands, under 40 characters, starting with a verb, like "Build the pricing section".
- Never put file paths, file names, commands, code or tool names in a step name.`

const GATE_TEXT = `Clean View: call ${PLAN_TOOL} first to lay out the steps of this job (2 to 8 short plain-English names), then try again. A TodoWrite or TaskCreate to-do list also counts as the plan.`

// Module state: rebuilt on every reload (session.start fires again then).
let ticker: Timer | undefined
let failStreak = 0
let isCommandPrompt = false
let lastApiError: { kind?: string; details?: string } | undefined
let idCounter = 0

const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(idCounter++).toString(36)}`
const clampPercent = (n: unknown) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)))
const isRunningPhase = (c: Checklist) => c.phase === 'working' || c.phase === 'needsYou' || c.phase === 'stuck'
const hasUnfinished = (c: Checklist) => c.tasks.some(t => t.status !== 'done')

// ---------- Checklist transitions (pure) ----------

function placeholderTasks(): ChecklistTask[] {
  return [
    { id: newId('p'), name: 'Understand your request', status: 'active', percent: 0, hasReported: false },
    { id: newId('p'), name: 'Plan the steps', status: 'upcoming', percent: 0, hasReported: false },
  ]
}

function startFirstUpcoming(tasks: ChecklistTask[]): ChecklistTask[] {
  if (tasks.some(t => t.status === 'active')) return tasks
  const i = tasks.findIndex(t => t.status === 'upcoming')
  return i < 0 ? tasks : tasks.map((t, j) => (j === i ? { ...t, status: 'active', percent: 0 } : t))
}

export function applyPlan(c: Checklist, steps: readonly string[]): Checklist {
  const tasks = steps.slice(0, 8).map<ChecklistTask>((name, i) => ({
    id: newId('s'),
    name: cleanName(name),
    status: i === 0 ? 'active' : 'upcoming',
    percent: 0,
    hasReported: false,
  }))
  return { ...c, tasks, hasRealPlan: true }
}

export function applyProgress(c: Checklist, rawName: string, rawPercent: unknown): Checklist {
  const name = cleanName(rawName)
  const percent = clampPercent(rawPercent)
  let tasks = c.hasRealPlan ? c.tasks.map(t => ({ ...t })) : []
  let i = tasks.findIndex(t => t.name.toLowerCase() === name.toLowerCase())

  if (i < 0) {
    const active = tasks.findIndex(t => t.status === 'active')
    const lastDone = tasks.map(t => t.status).lastIndexOf('done')
    i = active >= 0 ? active + 1 : lastDone + 1
    tasks.splice(i, 0, { id: newId('s'), name, status: 'upcoming', percent: 0, hasReported: false })
  }

  tasks = tasks.map((t, j) => {
    if (j < i) return { ...t, status: 'done', percent: 100 }
    if (j === i) return { ...t, status: 'active', percent, hasReported: true }
    return t.status === 'done' ? t : { ...t, status: 'upcoming', percent: 0 }
  })

  if (percent >= 100) {
    tasks[i] = { ...tasks[i], status: 'done', percent: 100 }
    const next = tasks.findIndex((t, j) => j > i && t.status !== 'done')
    if (next >= 0) tasks[next] = { ...tasks[next], status: 'active', percent: 0, hasReported: false }
  }
  return { ...c, tasks }
}

type Todo = { content: string; status: 'pending' | 'in_progress' | 'completed' }

export function applyTodos(c: Checklist, todos: readonly Todo[]): Checklist {
  const tasks = todos.map<ChecklistTask>((todo, i) => {
    const status = todo.status === 'completed' ? 'done' : todo.status === 'in_progress' ? 'active' : 'upcoming'
    const old = c.tasks[i]
    const keepsPercent = old && old.status === 'active' && status === 'active' && old.hasReported
    return {
      id: `todo-${i}`,
      name: cleanName(todo.content),
      status,
      percent: status === 'done' ? 100 : keepsPercent ? old.percent : 0,
      hasReported: Boolean(keepsPercent),
    }
  })
  return { ...c, tasks, hasRealPlan: tasks.length > 0 || c.hasRealPlan }
}

function setNeedsYou(c: Checklist, reason: string): Checklist {
  return { ...c, phase: 'needsYou', needsYouReason: reason }
}

function clearNeedsYou(c: Checklist): Checklist {
  return c.phase === 'needsYou' ? { ...c, phase: 'working', needsYouReason: null } : c
}

function setStuck(c: Checklist, reason: string): Checklist {
  return { ...c, phase: 'stuck', stuckReason: reason, needsYouReason: null }
}

// ---------- Small helpers (no engine calls) ----------

const shouldTick = (c: Checklist, mode: ViewMode) => mode !== 'full' && (c.phase === 'working' || c.phase === 'needsYou')

function stopTicker() {
  ticker?.cancel()
  ticker = undefined
}

function styleToast(style: CleanViewStyle): string {
  return style === 'simple'
    ? 'Clean View: Simple. Only the checklist shows.'
    : 'Clean View: Guided. The checklist plus one short line per action.'
}

const styleLabel = (style: CleanViewStyle) => (style === 'simple' ? 'View: Simple' : 'View: Guided')
const nextStyle = (style: CleanViewStyle) => STYLES[(STYLES.indexOf(style) + 1) % STYLES.length]

const NAME_SYSTEM =
  'Name the job described in the request in 2 to 6 plain English words, starting with a verb, like "Build my landing page". No file names, code or punctuation. Answer with the name only.'

function jobTitleFrom(answer: string): string {
  return cleanName(answer.split('\n')[0].replace(/^["'\s]+|["'.\s]+$/g, ''))
}

function recordAction(c: Checklist, action: ChecklistAction): Checklist {
  return { ...c, actions: [...c.actions.filter(a => a.id !== action.id), action].slice(-MAX_ACTIONS) }
}

// ---------- Drawing helpers ----------

function pad(text: string, width: number): string {
  const cut = trimToWidth(text, width)
  return cut + ' '.repeat(Math.max(0, width - cut.length))
}

function meterFor(task: ChecklistTask, tick: number): string {
  if (task.status === 'done') return '█'.repeat(METER)
  if (task.status === 'upcoming') return '░'.repeat(METER)
  if (!task.hasReported) {
    const head = (tick % (METER + 3)) - 3
    return Array.from({ length: METER }, (_, i) => (i >= head && i < head + 3 ? '█' : '░')).join('')
  }
  const filled = Math.round(task.percent / 10)
  return '█'.repeat(filled) + '░'.repeat(METER - filled)
}

function actionLine(a: { icon: string; label: string; detail: string }): string {
  return `${a.icon} ${a.label}${a.detail ? ` · ${a.detail}` : ''}`
}

// ---------- Hooks ----------

export function registerCleanView(on: On) {
  on('command.run', { command: 'view' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'on' || arg === 'off' || arg === 'full') {
      const isOn = arg === 'on'
      const written = await update($, enabledModsAtom, map => ({ ...map, 'clean-view': isOn }))
      await $.store.set(STORE_ENABLED, written)
      return { text: isOn ? 'Clean View is on.' : 'Clean View is off. Everything Claude does is shown in full.' }
    }
    if (arg !== '' && arg !== 'simple' && arg !== 'guided') {
      return { text: 'Use /view simple, /view guided, /view on or /view off. With nothing after it, /view switches between Simple and Guided.' }
    }
    const style = arg === '' ? nextStyle(await read($, styleAtom)) : (arg as CleanViewStyle)
    const written = await update($, modSettingsAtom, map => ({ ...map, [STYLE_SETTING]: style }))
    await $.store.set(STORE_SETTINGS, written)
    return { text: styleToast(style) }
  })

  on('prompt.submit', ($, e, next) => {
    isCommandPrompt = e.command !== undefined
    return next(e)
  })

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    if ((await read($, modeAtom)) === 'full') return composed
    return {
      sections: [...composed.sections, { id: 'rhazi3l-mods:clean-view', text: PROMPT_SECTION, scope: 'session' as const }],
    }
  })

  on('turn.start', async ($, e, next) => {
    const started = await next(e)
    if (e.agentId !== undefined) return started

    const mode = await read($, modeAtom)
    const current = await read($, checklistAtom)
    const isNewJob =
      e.text.trim() !== '' &&
      !isCommandPrompt &&
      (!isRunningPhase(current) || (current.phase === 'stuck' && !hasUnfinished(current)))
    isCommandPrompt = false
    failStreak = 0
    lastApiError = undefined

    if (isNewJob) {
      const now = await $.clock.now()
      const written = await update($, checklistAtom, c => ({
        ...EMPTY,
        jobId: c.jobId + 1,
        title: 'Working on your request',
        phase: 'working',
        tasks: placeholderTasks(),
        startedAt: now,
      }))
      if (mode !== 'full') {
        const text = e.text
        const jobId = written.jobId
        $.clock.after(0, () => {
          void $.model
            .complete({ model: 'haiku', effort: 'low', maxTokens: 30, timeoutMs: 20000, system: NAME_SYSTEM, prompt: text.slice(0, 4000) })
            .then(answer => {
              if (!answer.isAnswered) return
              const title = jobTitleFrom(answer.text)
              return update($, checklistAtom, c => (c.jobId === jobId ? { ...c, title } : c))
            })
            .catch(() => undefined)
        })
      }
      if (shouldTick(written, mode) && !ticker) {
        ticker = $.clock.every(TICK_MS, () => {
          void Promise.all([read($, checklistAtom), read($, modeAtom)]).then(([list, view]) =>
            shouldTick(list, view) ? update($, tickAtom, n => n + 1) : stopTicker(),
          )
        })
      }
    } else if (isRunningPhase(current)) {
      await update($, checklistAtom, c => ({ ...c, phase: 'working', needsYouReason: null, stuckReason: null }))
    }
    return started
  })

  // The model's two checklist tools.
  on('tool.call', { tool: 'mcp__rhazi3l-mods__plan_steps' }, async ($, e) => {
    const raw = (e as unknown as { steps?: unknown }).steps
    const steps = Array.isArray(raw) ? raw.map(s => String(s)).filter(s => s.trim() !== '') : []
    if (steps.length === 0) return { deny: 'plan_steps needs at least one step name.' }
    if (e.agentId !== undefined) return { result: 'Noted.' }
    const written = await update($, checklistAtom, c => clearNeedsYou(applyPlan(c, steps)))
    return { result: `Planned ${written.tasks.length} steps. The first one has started.` }
  })

  on('tool.call', { tool: 'mcp__rhazi3l-mods__report_progress' }, async ($, e) => {
    const args = e as unknown as { task?: unknown; percent?: unknown }
    const percent = clampPercent(args.percent)
    if (e.agentId === undefined) {
      await update($, checklistAtom, c => clearNeedsYou(applyProgress(c, String(args.task ?? ''), percent)))
    }
    return { result: `Progress noted: ${percent}%.` }
  })

  // Every other tool: the plan-first gate, the needs-you and stuck states,
  // the to-do list as the checklist, and the action trail.
  on('tool.call', async ($, e, next) => {
    const tool = String(e.tool)
    if (e.agentId !== undefined || tool.startsWith(OWN_PREFIX)) return next(e)

    const mode = await read($, modeAtom)
    const before = await read($, checklistAtom)
    const isGated =
      mode !== 'full' && isRunningPhase(before) && before.startedAt !== null && !before.hasRealPlan && !ALWAYS_ALLOWED.has(tool)
    if (isGated) return { deny: GATE_TEXT }

    const summary = describeAction(tool, e, OWN_PREFIX)
    await update($, checklistAtom, c => {
      let changed = tool === 'AskUserQuestion' ? setNeedsYou(c, REASON_QUESTION) : clearNeedsYou(c)
      if (summary) changed = recordAction(changed, { id: e.tool_use_id ?? newId('a'), ...summary, isFailed: false })
      return changed
    })

    const ran = await next(e)
    const isFailed = ran.deny !== undefined || ran.isError === true
    const failText = ran.deny ?? (ran.isError ? ran.text : undefined)

    await update($, checklistAtom, c => {
      let changed = c
      if (tool === 'AskUserQuestion' || changed.needsYouReason === REASON_PERMISSION) changed = clearNeedsYou(changed)

      if (!isFailed) {
        if (e.tool === 'TodoWrite') changed = applyTodos(changed, e.todos)
        if (e.tool === 'TaskCreate' && ran.result) {
          const created = (ran.result as { task?: { id?: string } }).task
          const base = changed.hasRealPlan ? changed.tasks : []
          const task: ChecklistTask = {
            id: `task-${created?.id ?? newId('t')}`,
            name: cleanName(e.subject),
            status: 'upcoming',
            percent: 0,
            hasReported: false,
          }
          changed = { ...changed, hasRealPlan: true, tasks: startFirstUpcoming([...base, task]) }
        }
        if (e.tool === 'TaskUpdate') {
          const id = `task-${e.taskId}`
          const status = e.status
          let tasks = changed.tasks
            .filter(t => !(t.id === id && status === 'deleted'))
            .map(t => {
              if (t.id !== id) return t
              const renamed = e.subject ? { ...t, name: cleanName(e.subject) } : t
              if (status === 'completed') return { ...renamed, status: 'done' as const, percent: 100 }
              if (status === 'in_progress') return { ...renamed, status: 'active' as const }
              if (status === 'pending') return { ...renamed, status: 'upcoming' as const, percent: 0 }
              return renamed
            })
          if (status === 'completed') tasks = startFirstUpcoming(tasks)
          changed = { ...changed, tasks }
        }
        if (changed.phase === 'stuck' && changed.stuckReason !== null) {
          changed = { ...changed, phase: 'working', stuckReason: null }
        }
      } else if (isUserRefusal(failText)) {
        changed = setStuck(changed, STUCK_REFUSED)
      } else if (failStreak + 1 >= FAILS_BEFORE_STUCK) {
        changed = setStuck(changed, STUCK_FAILING)
      }

      if (summary && isFailed) {
        changed = {
          ...changed,
          actions: changed.actions.map(a => (a.id === e.tool_use_id ? { ...a, isFailed: true } : a)),
        }
      }
      return changed
    })

    failStreak = !isFailed || isUserRefusal(failText) ? 0 : failStreak + 1
    return ran
  }).catch(($, e, next) => next(e))

  on('classic.Notification', async ($, e, next) => {
    if (e.agent_id === undefined) {
      if (e.notification_type === 'permission_prompt') await update($, checklistAtom, c => (isRunningPhase(c) ? setNeedsYou(c, REASON_PERMISSION) : c))
      if (e.notification_type === 'elicitation_dialog') await update($, checklistAtom, c => (isRunningPhase(c) ? setNeedsYou(c, REASON_QUESTION) : c))
    }
    return next(e)
  })

  on('classic.StopFailure', async ($, e, next) => {
    if (e.agent_id === undefined) {
      lastApiError = { kind: e.error, details: e.error_details }
      const sentence = apiErrorSentence(e.error, e.error_details)
      await update($, checklistAtom, c => (c.phase === 'stuck' && c.stuckReason !== STUCK_REFUSED ? { ...c, stuckReason: sentence } : c))
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const ended = await next(e)
    if (e.agentId !== undefined) return ended

    const now = await $.clock.now()
    const written = await update($, checklistAtom, c => {
      if (c.startedAt === null) return c
      if (e.reason === 'error') return setStuck(c, apiErrorSentence(lastApiError?.kind, lastApiError?.details))
      if (e.reason === 'refusal') return setStuck(c, STUCK_REFUSAL)
      if (e.reason === 'aborted') return { ...c, phase: 'stopped', needsYouReason: null, finishedAt: now }
      if (c.phase === 'stuck' && c.stuckReason === STUCK_REFUSED) return c
      if (c.hasRealPlan && hasUnfinished(c)) return setNeedsYou(c, REASON_REPLY)
      const tasks = c.tasks.map(t => ({ ...t, status: 'done' as const, percent: 100 }))
      return { ...c, tasks, phase: 'done', needsYouReason: null, stuckReason: null, finishedAt: now, isCollapsed: false }
    })

    if (!shouldTick(written, await read($, modeAtom))) stopTicker()
    if (written.phase === 'done') {
      const jobId = written.jobId
      $.clock.after(COLLAPSE_MS, () => {
        void update($, checklistAtom, c => (c.jobId === jobId && c.phase === 'done' ? { ...c, isCollapsed: true } : c))
      })
    }
    return ended
  })

  // ---------- Drawing ----------

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const { Box, Text, Button } = $.ui.resolve(e)
    const mode = await read($, modeAtom)
    const c = await read($, checklistAtom)
    const tick = await read($, tickAtom)
    const now = await $.clock.now()
    const width = Math.max(20, e.props.bodyColumns)

    const style = await read($, styleAtom)
    const button = (
      <Button
        key="clean-view-style"
        label={styleLabel(style)}
        onPress={async () => {
          const chosen = nextStyle(await read($, styleAtom))
          const written = await update($, modSettingsAtom, map => ({ ...map, [STYLE_SETTING]: chosen }))
          await $.store.set(STORE_SETTINGS, written)
          $.ui.toast(styleToast(chosen))
        }}
      />
    )
    const showsChecklist = mode !== 'full' && c.phase !== 'idle' && c.startedAt !== null

    if (!showsChecklist) return next(e)
    const below = await next(e)

    const elapsed = formatDuration((c.finishedAt ?? now) - (c.startedAt ?? now))
    let header = <Text bold wrap="truncate-end">{`${c.title} · ${elapsed}`}</Text>
    if (c.phase === 'needsYou') {
      header = (
        <Text wrap="truncate-end">
          <Text backgroundColor="warning" color="inverseText" bold>
            {' Needs you '}
          </Text>
          {` ${c.needsYouReason ?? REASON_REPLY}`}
        </Text>
      )
    } else if (c.phase === 'stuck') {
      header = (
        <Text color="warning" wrap="truncate-end">
          {`⚠ Stuck: ${c.stuckReason ?? STUCK_FAILING}`}
        </Text>
      )
    } else if (c.phase === 'stopped') {
      header = <Text wrap="truncate-end">{`■ Stopped · ${c.title} · you pressed Esc`}</Text>
    } else if (c.phase === 'done') {
      header = (
        <Text color="success" wrap="truncate-end">
          {`✓ All done · ${c.title} · took ${elapsed}`}
        </Text>
      )
    }

    const headerRow = (
      <Box key="clean-view-header" flexDirection="row" justifyContent="space-between">
        <Box flexGrow={1} flexShrink={1}>
          {header}
        </Box>
        {button}
      </Box>
    )
    if (c.phase === 'done' && c.isCollapsed) {
      return (
        <Box flexDirection="column">
          {headerRow}
          {below}
        </Box>
      )
    }

    const nameWidth = Math.max(8, Math.min(MAX_NAME, width - 24))
    const firstUpcoming = c.tasks.findIndex(t => t.status === 'upcoming')
    const recent = c.actions.slice(-3)
    const showsTrail = mode === 'guided' && recent.length > 0 && c.phase !== 'done'

    const rows = c.tasks.flatMap((task, i) => {
      const isActive = task.status === 'active'
      const icon = task.status === 'done' ? '✓' : isActive ? (c.phase === 'needsYou' ? '‖' : '▶') : '○'
      const label =
        task.status === 'done'
          ? 'Done'
          : isActive
            ? task.hasReported
              ? `${task.percent}%`
              : 'Working'
            : i === firstUpcoming
              ? 'Next'
              : 'Up next'
      const row = (
        <Box key={`task-${task.id}`} flexDirection="row">
          <Text color={task.status === 'done' ? 'success' : isActive ? 'claude' : undefined} dimColor={task.status === 'upcoming'}>
            {`${icon} `}
          </Text>
          <Text bold={isActive} dimColor={!isActive}>
            {pad(task.name, nameWidth)}
          </Text>
          <Text color={task.status === 'done' ? 'success' : isActive ? 'claude' : undefined} dimColor={task.status === 'upcoming'}>
            {` ${meterFor(task, tick)}  `}
          </Text>
          <Text dimColor={!isActive}>{label}</Text>
        </Box>
      )
      if (!isActive || !showsTrail) return [row]
      const trail = recent.map(a => `${a.isFailed ? '✗ ' : ''}${a.icon} ${a.detail || a.label}`).join('  ·  ')
      return [
        row,
        <Box key="clean-view-trail" paddingLeft={2}>
          <Text dimColor wrap="truncate-end">{`↳ ${trail}`}</Text>
        </Box>,
      ]
    })

    return (
      <Box flexDirection="column">
        {headerRow}
        {rows}
        {below}
      </Box>
    )
  })

  // Tool rows in the transcript: hidden in Simple, one plain line in Guided.
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    const mode = await read($, modeAtom)
    if (mode === 'full') return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const summary = describeAction(e.props.tool, e.props.input, OWN_PREFIX)
    if (mode === 'simple' || !summary) return <Box />

    const isFailed = e.props.isErrored
    const outcome = e.props.isInterrupted
      ? 'stopped'
      : isFailed
        ? isUserRefusal(String(e.props.output ?? ''))
          ? 'you said no'
          : "didn't work"
        : null
    return (
      <Box flexDirection="row">
        <Text dimColor={!e.props.isRunning} wrap="truncate-end">
          {actionLine(summary)}
        </Text>
        {e.props.isRunning && <Text color="claude">{' …'}</Text>}
        {outcome && <Text color="error">{` · ${outcome}`}</Text>}
      </Box>
    )
  })

  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    const mode = await read($, modeAtom)
    if (mode === 'full') return next(e)
    const { Box } = $.ui.resolve(e)
    return <Box />
  })

  on('ui.render', { component: 'ToolGroup' }, async ($, e, next) => {
    const mode = await read($, modeAtom)
    if (mode === 'full') return next(e)
    const { Box, Text } = $.ui.resolve(e)
    if (mode === 'simple') return <Box />
    const lines = e.props.calls
      .map((call, i) => ({ i, call, summary: describeAction(call.tool, call.input, OWN_PREFIX) }))
      .filter(one => one.summary !== null)
    return (
      <Box flexDirection="column">
        {lines.map(({ i, call, summary }) => (
          <Box key={`call-${call.tool_use_id ?? i}`} flexDirection="row">
            <Text dimColor={!call.isRunning} wrap="truncate-end">
              {actionLine(summary!)}
            </Text>
            {call.isErrored && <Text color="error">{" · didn't work"}</Text>}
          </Box>
        ))}
      </Box>
    )
  })

  on('ui.render', { component: 'ToolProgress' }, async ($, e, next) => {
    const mode = await read($, modeAtom)
    if (mode === 'full') return next(e)
    return next({ ...e, props: { ...e.props, hint: '' } })
  })
}

