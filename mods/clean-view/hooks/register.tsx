// Clean View: a calm checklist above the prompt in place of the technical
// tool rows, which it hides from the transcript.
//
// The checklist always shows the latest action on the step in progress. The Details pane lists every step and every action of
// the job in full, and can bring the engine's own tool rows back. Full (Clean
// View off) leaves Claude Code as it is.

import { atom, derive, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderChildren, Timer } from 'claude-code'

import type { Checklist, ChecklistAction, ChecklistTask, ViewMode } from '../types'
import { COMMANDS } from './info'
import { PASTEL } from './palette'
import {
  apiErrorSentence,
  cleanName,
  extractQuestion,
  describeAction,
  describeFull,
  clipOutput,
  firstLine,
  formatDuration,
  isUserRefusal,
  quickReplies,
  MAX_NAME,
  trimToWidth,
} from './text'

const OWN_PREFIX = 'mcp__clean-view__'
const DEFAULT_TITLE = 'Working on your request'
const METER = 10
/** How many steps the checklist shows at once; the rest are summed up in one line. */
export const MAX_VISIBLE_STEPS = 3
/** Room for a step's label after its bar: two cells of gap, then `Working` or `Up next`. */
const LABEL_CELLS = 9
const TICK_MS = 250
const COLLAPSE_MS = 5000
const MAX_ACTIONS = 300
const DETAILS_PANE = 'clean-view-details'
const DETAILS_TITLE = 'What Claude did'
const COLOURS_TITLE = 'Frame colours'
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
  question: '',
  replies: [],
  stuckReason: null,
  startedAt: null,
  finishedAt: null,
  isCollapsed: false,
  hasRealPlan: false,
  jobId: 0,
  actions: [],
}

// Values the drawings read (types/index.d.ts). `isOn` is saved in $.store too, so it
// lasts past the session; the toolbox reads it.
const STORE_ON = 'isOn'
const COLOURS_PANE = 'clean-view-colours'
const isOnAtom = atom({ plugin: 'clean-view', key: 'isOn' } as const, true)
const checklistAtom = atom({ plugin: 'clean-view', key: 'checklist' } as const, EMPTY)
const tickAtom = atom({ plugin: 'clean-view', key: 'tick' } as const, 0)
const narrationAtom = atom({ plugin: 'clean-view', key: 'narration' } as const, [] as string[])

/** The view in force: guided, or `full` while Clean View is off. */
const modeAtom = derive([isOnAtom], (isOn): ViewMode => (isOn ? 'guided' : 'full'))

/** Whether the transcript shows the engine's own tool rows: only while Clean View is off. */
const showsToolRowsAtom = derive([modeAtom], mode => mode === 'full')

const PROMPT_SECTION = `# Clean View
The person sees your to-do list as a plain-English checklist; tool output is hidden.
- For work of two or more steps, start with a to-do list (TodoWrite, TaskCreate, or the app's own plan tool, update_plan) and keep it current, marking each step completed as soon as it is done. Skip the list for a quick question.
- Write every step name in plain English, under 40 characters, starting with a verb, like "Build the pricing section". No file paths, file names, commands, code or tool names.
- Answer first, in as few words as possible. Do not narrate steps or repeat results the person can open in Details. End with a short plain-English summary of what changed and anything they must decide.`

// Module state: rebuilt on every reload (session.start fires again then).
let ticker: Timer | undefined
let failStreak = 0
let isCommandPrompt = false
let lastApiError: { kind?: string; details?: string } | undefined
let idCounter = 0

const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(idCounter++).toString(36)}`
const isRunningPhase = (c: Checklist) => c.phase === 'working' || c.phase === 'needsYou' || c.phase === 'stuck'
const hasUnfinished = (c: Checklist) => c.tasks.some(t => t.status !== 'done')

// ---------- Checklist transitions (pure) ----------

function startFirstUpcoming(tasks: ChecklistTask[]): ChecklistTask[] {
  if (tasks.some(t => t.status === 'active')) return tasks
  const i = tasks.findIndex(t => t.status === 'upcoming')
  return i < 0 ? tasks : tasks.map((t, j) => (j === i ? { ...t, status: 'active', percent: 0 } : t))
}

/** The header names the job after its first step once a plan arrives, until then it keeps the placeholder. */
const titleFor = (c: Checklist, tasks: readonly ChecklistTask[]) => (c.title === DEFAULT_TITLE && tasks[0] ? tasks[0].name : c.title)

type Todo = { content: string; status: 'pending' | 'in_progress' | 'completed' }

const PLAN_TOOL = 'mcp__ccd_turn__update_plan'

/**
 * A plan tool's step updates on the current list: `advance` finishes the step in progress and
 * starts the next waiting one, `done` finishes steps by their 1-based number, `start` begins one.
 */
export function applyPlanStep(c: Checklist, args: { advance?: unknown; done?: unknown; start?: unknown }): Checklist {
  const pick = (n: unknown) => (typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= c.tasks.length ? n - 1 : -1)
  const finished = new Set<number>(
    Array.isArray(args.done) ? args.done.map(pick).filter(i => i >= 0) : [],
  )
  if (args.advance === true) {
    const active = c.tasks.findIndex(t => t.status === 'active')
    if (active >= 0) finished.add(active)
  }
  const begun = pick(args.start)
  let tasks = c.tasks.map((t, i): ChecklistTask => {
    if (finished.has(i)) return { ...t, status: 'done', percent: 100 }
    if (i === begun) return { ...t, status: 'active', percent: 0, hasReported: false }
    return t
  })
  if (finished.size > 0) tasks = startFirstUpcoming(tasks)
  return { ...c, tasks }
}

/** The `{content, status}` entries of a full list a plan tool sends, leaving out anything malformed. */
export function plannedTodos(items: unknown): Todo[] {
  if (!Array.isArray(items)) return []
  return items.flatMap((item): Todo[] => {
    const { content, status } = (item ?? {}) as { content?: unknown; status?: unknown }
    if (typeof content !== 'string' || (status !== 'pending' && status !== 'in_progress' && status !== 'completed')) return []
    return [{ content, status }]
  })
}

function applyTodos(c: Checklist, todos: readonly Todo[]): Checklist {
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
  return { ...c, tasks, title: titleFor(c, tasks), hasRealPlan: tasks.length > 0 || c.hasRealPlan }
}

/** Whether the last paragraph of an answer ends in a question, the sign Claude is waiting for the person. */
export function asksSomething(answer: string): boolean {
  const last = answer.trim().split(/\n\s*\n/).pop() ?? ''
  return /\?[\s"'”)*_`]*$/.test(last.trim())
}

function setNeedsYou(c: Checklist, reason: string, answer = ''): Checklist {
  return { ...c, phase: 'needsYou', needsYouReason: reason, question: extractQuestion(answer), replies: answer === '' ? [] : quickReplies(answer) }
}

function clearNeedsYou(c: Checklist): Checklist {
  return c.phase === 'needsYou' ? { ...c, phase: 'working', needsYouReason: null, question: '', replies: [] } : c
}

function setStuck(c: Checklist, reason: string): Checklist {
  return { ...c, phase: 'stuck', stuckReason: reason, needsYouReason: null }
}

// ---------- Small helpers (no engine calls) ----------

const shouldTick = (c: Checklist, mode: ViewMode) => mode !== 'full' && (c.phase === 'working' || c.phase === 'needsYou' || c.phase === 'stuck')

function stopTicker() {
  ticker?.cancel()
  ticker = undefined
}

function recordAction(c: Checklist, action: ChecklistAction): Checklist {
  return { ...c, actions: [...c.actions.filter(a => a.id !== action.id), action].slice(-MAX_ACTIONS) }
}

function markFailed(c: Checklist, id: string, note: string): Checklist {
  return { ...c, actions: c.actions.map(a => (a.id === id ? { ...a, isFailed: true, note } : a)) }
}

function setOutput(c: Checklist, id: string, output: string): Checklist {
  return { ...c, actions: c.actions.map(a => (a.id === id ? { ...a, output } : a)) }
}

/** The step a new action belongs to: the one in progress, else the last one started. */
function currentStep(c: Checklist): string {
  const active = c.tasks.find(t => t.status === 'active')
  return active?.name ?? [...c.tasks].reverse().find(t => t.status === 'done')?.name ?? ''
}

/**
 * The steps in the order the Details pane lists them: steps that only actions
 * remember (the placeholders before a plan) first, then the plan.
 */
function detailGroups(c: Checklist): { step: string; status: ChecklistTask['status']; actions: ChecklistAction[] }[] {
  const planned = new Set(c.tasks.map(t => t.name))
  const earlier = [...new Set(c.actions.map(a => a.step).filter(step => !planned.has(step)))]
  return [
    ...earlier.map(step => ({ step, status: 'done' as const, actions: c.actions.filter(a => a.step === step) })),
    ...c.tasks.map(t => ({ step: t.name, status: t.status, actions: c.actions.filter(a => a.step === t.name) })),
  ]
}

// ---------- Drawing helpers ----------

/**
 * Which steps of a long list to draw: the one in progress first, then what comes next, so finished steps
 * drop out of sight. Near the end it pulls back to keep `max` rows (finished steps fill the gap).
 */
export function stepWindow(tasks: readonly ChecklistTask[], max = MAX_VISIBLE_STEPS): { start: number; end: number } {
  if (tasks.length <= max) return { start: 0, end: tasks.length }
  let focus = tasks.findIndex(t => t.status === 'active')
  if (focus < 0) focus = tasks.findIndex(t => t.status === 'upcoming')
  if (focus < 0) focus = tasks.length - 1
  const start = Math.max(0, Math.min(focus, tasks.length - max))
  return { start, end: start + max }
}

/** A step's bar as lit and unlit cells (`━`): full, empty, a share, or a moving run while no share is known. */
export function meterCells(task: ChecklistTask, tick: number): boolean[] {
  if (task.status === 'done') return Array.from({ length: METER }, () => true)
  if (task.status === 'upcoming') return Array.from({ length: METER }, () => false)
  if (!task.hasReported) {
    const head = (tick % (METER + 3)) - 3
    return Array.from({ length: METER }, (_, i) => i >= head && i < head + 3)
  }
  const filled = Math.round(task.percent / 10)
  return Array.from({ length: METER }, (_, i) => i < filled)
}

/** Lit and unlit cells grouped into runs, so each run draws as one Text. */
function meterRuns(cells: boolean[]): { lit: boolean; text: string }[] {
  const runs: { lit: boolean; text: string }[] = []
  for (const lit of cells) {
    const last = runs[runs.length - 1]
    if (last && last.lit === lit) last.text += '━'
    else runs.push({ lit, text: '━' })
  }
  return runs
}

/** Drawn bars: each cell is this many pixels wide, and the bar this thick, centred in a box this tall. */
const BAR_CELL_PX = 8
const BAR_THICK_PX = 3
const BAR_BOX_PX = 16
/** The unlit track: a neutral grey that reads on the desktop's light and dark themes alike. */
const BAR_TRACK = '#787d87'

/**
 * A bar as an SVG: an unlit track with a run of lit cells on top for each run in `cells`. The desktop app
 * draws text in a proportional font, so a `━` character sits at another height than the label beside it;
 * a drawing centred in its row does not.
 */
export function barSvg(cells: boolean[], litColor: string): string {
  const width = cells.length * BAR_CELL_PX
  const y = (BAR_BOX_PX - BAR_THICK_PX) / 2
  const rect = (x: number, w: number, fill: string, opacity: number) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${BAR_THICK_PX}" rx="1.5" fill="${fill}" opacity="${opacity}"/>`
  const lit: string[] = []
  for (let i = 0; i < cells.length; i++) {
    if (!cells[i]) continue
    let end = i
    while (end + 1 < cells.length && cells[end + 1]) end++
    lit.push(rect(i * BAR_CELL_PX, (end - i + 1) * BAR_CELL_PX, litColor, 1))
    i = end
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${BAR_BOX_PX}" viewBox="0 0 ${width} ${BAR_BOX_PX}">${rect(0, width, BAR_TRACK, 0.35)}${lit.join('')}</svg>`
}

// ---------- Hooks ----------

/**
 * A /clear starts the session's values over and fires no session.start, so Clean View's on/off (which the
 * toolbox reads to show its button) is written again from what was saved.
 */
async function restoreAfterClear($: EngineInterface) {
  const { value } = await $.state.get({ plugin: 'clean-view', key: 'isOn' } as const)
  if (value !== undefined) return
  const savedOn = await $.store.get(STORE_ON)
  await update($, isOnAtom, () => (typeof savedOn === 'boolean' ? savedOn : true))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const savedOn = await $.store.get(STORE_ON)
    // Written even when unchanged, so other mods can tell Clean View is installed.
    await update($, isOnAtom, () => (typeof savedOn === 'boolean' ? savedOn : true))
    try {
      for (const command of COMMANDS) await $.command.register(command)
    } catch {
      // Not bound (a headless host): Clean View still follows what it can.
    }
    return next(e)
  })

  on('command.run', { command: 'view' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'details') {
      const opened = await $.ui.open({ id: DETAILS_PANE, title: DETAILS_TITLE })
      return {
        text: opened.isPlaced
          ? 'Details open: every step and action of this job.'
          : `Details will show when there is room (${opened.reason}).`,
      }
    }
    if (arg === 'colours' || arg === 'colors') {
      const opened = await $.ui.open({ id: COLOURS_PANE, title: COLOURS_TITLE })
      return {
        text: opened.isPlaced
          ? 'Frame colours open: every colour the checklist uses, and when.'
          : `The frame colours will show when there is room (${opened.reason}).`,
      }
    }
    if (arg === 'on' || arg === 'off' || arg === 'full') {
      const isOn = arg === 'on'
      await update($, isOnAtom, () => isOn)
      await $.store.set(STORE_ON, isOn)
      return { text: isOn ? 'Clean View is on.' : 'Clean View is off. Everything Claude does is shown in full.' }
    }
    return { text: 'Use /view details, /view colours, /view on or /view off.' }
  })

  on('prompt.submit', ($, e, next) => {
    isCommandPrompt = e.command !== undefined
    return next(e)
  })

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    if ((await read($, modeAtom)) === 'full') return composed
    return {
      sections: [...composed.sections, { id: 'clean-view', text: PROMPT_SECTION, scope: 'session' as const }],
    }
  })

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') $.clock.after(200, () => void restoreAfterClear($))
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    await restoreAfterClear($)
    const started = await next(e)
    if (e.agentId !== undefined) return started

    const mode = await read($, modeAtom)
    const current = await read($, checklistAtom)
    const isNewJob =
      e.text.trim() !== '' &&
      !isCommandPrompt &&
      (!isRunningPhase(current) ||
        ((current.phase === 'stuck' || current.phase === 'needsYou') && !hasUnfinished(current)))
    isCommandPrompt = false
    failStreak = 0
    lastApiError = undefined

    if (isNewJob) {
      const now = await $.clock.now()
      const written = await update($, checklistAtom, (c): Checklist => ({
        ...EMPTY,
        jobId: c.jobId + 1,
        title: DEFAULT_TITLE,
        phase: 'working',
        startedAt: now,
      }))
      if (shouldTick(written, mode) && !ticker) {
        ticker = $.clock.every(TICK_MS, async () => {
          const [list, view] = await Promise.all([read($, checklistAtom), read($, modeAtom)])
          if (shouldTick(list, view)) await update($, tickAtom, n => n + 1)
          else stopTicker()
        })
      }
    } else if (isRunningPhase(current)) {
      await update($, checklistAtom, (c): Checklist => ({ ...c, phase: 'working', needsYouReason: null, stuckReason: null, question: '', replies: [] }))
    }
    return started
  })

  // Every tool: the needs-you and stuck states, the to-do list as the
  // checklist, and the action trail.
  on('tool.call', async ($, e, next) => {
    const tool = String(e.tool)
    if (tool.startsWith(OWN_PREFIX)) return next(e)
    if (e.agentId !== undefined) {
      // A helper agent's call: kept for the Details pane, nothing else.
      const summary = describeAction(tool, e, OWN_PREFIX)
      if (!summary) return next(e)
      const id = e.tool_use_id ?? newId('a')
      await update($, checklistAtom, c =>
        isRunningPhase(c)
          ? recordAction(c, { id, ...summary, full: describeFull(tool, e), step: currentStep(c), isHelper: true, isFailed: false, note: '', output: '' })
          : c,
      )
      const ran = await next(e)
      const output = clipOutput(ran.deny ?? ran.text)
      await update($, checklistAtom, c => setOutput(c, id, output))
      if (ran.deny !== undefined || ran.isError === true) {
        const note = firstLine(ran.deny ?? ran.text)
        await update($, checklistAtom, c => markFailed(c, id, note))
      }
      return ran
    }

    const summary = describeAction(tool, e, OWN_PREFIX)
    const actionId = e.tool_use_id ?? newId('a')
    await update($, checklistAtom, c => {
      let changed = tool === 'AskUserQuestion' ? setNeedsYou(c, REASON_QUESTION) : clearNeedsYou(c)
      if (summary) {
        changed = recordAction(changed, {
          id: actionId,
          ...summary,
          full: describeFull(tool, e),
          step: currentStep(changed),
          isHelper: false,
          isFailed: false,
          note: '',
          output: '',
        })
      }
      return changed
    })

    const ran = await next(e)
    const isFailed = ran.deny !== undefined || ran.isError === true
    const failText = ran.deny ?? (ran.isError ? ran.text : undefined)
    const output = clipOutput(ran.deny ?? ran.text)

    await update($, checklistAtom, c => {
      let changed = setOutput(c, actionId, output)
      if (tool === 'AskUserQuestion' || changed.needsYouReason === REASON_PERMISSION) changed = clearNeedsYou(changed)

      if (!isFailed) {
        if (e.tool === 'TodoWrite') changed = applyTodos(changed, e.todos)
        if (e.tool === PLAN_TOOL) {
          const args = e as { items?: unknown; advance?: unknown; done?: unknown; start?: unknown }
          const todos = plannedTodos(args.items)
          changed = todos.length > 0 ? applyTodos(changed, todos) : applyPlanStep(changed, args)
        }
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
          const tasks = startFirstUpcoming([...base, task])
          changed = { ...changed, hasRealPlan: true, tasks, title: titleFor(changed, tasks) }
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

      if (summary && isFailed && e.tool_use_id) changed = markFailed(changed, e.tool_use_id, firstLine(failText))
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
    const written = await update($, checklistAtom, (c): Checklist => {
      if (c.startedAt === null) return c
      if (e.reason === 'error') return setStuck(c, apiErrorSentence(lastApiError?.kind, lastApiError?.details))
      if (e.reason === 'refusal') return setStuck(c, STUCK_REFUSAL)
      if (e.reason === 'aborted') return { ...c, phase: 'stopped', needsYouReason: null, finishedAt: now }
      if (c.phase === 'stuck' && c.stuckReason === STUCK_REFUSED) return c
      // Claude is waiting on the person when its answer ends in a question, whatever the steps say;
      // an answer that only left steps open simply did not tick them off.
      if (asksSomething(e.answer)) return setNeedsYou(c, REASON_REPLY, e.answer)
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

    const mode = await read($, modeAtom)
    const c = await read($, checklistAtom)
    if (mode === 'full' || c.phase === 'idle' || c.startedAt === null) return next(e)
    const below = await next(e)

    const ui = $.ui.resolve(e)
    const { Box, Text, Button } = ui
    const tick = await read($, tickAtom)
    const now = await $.clock.now()
    // Inside the frame: its border and padding take four columns.
    const width = Math.max(20, e.props.bodyColumns - 4)
    // The terminal draws in even character cells, so bars and columns can be
    // sized to its width. The desktop app draws its own font and native
    // buttons, wider than the cells it reports, so there the boxes do the
    // aligning, bars keep a fixed size and the buttons wrap.
    const isTerminal = e.surface === 'terminal'
    // Where the surface can draw an image, bars are drawn as one, centred in their row (see barSvg).
    const Svg = !isTerminal && 'Svg' in ui ? ui.Svg : undefined

    const buttons = (
      <Box key="clean-view-buttons" flexDirection="row" flexShrink={0}>
        <Button
          key="clean-view-details"
          label="Details"
          hotkey="d"
          onPress={() => $.ui.open({ id: DETAILS_PANE, title: DETAILS_TITLE })}
        />
      </Box>
    )
    const elapsed = formatDuration((c.finishedAt ?? now) - c.startedAt)
    // With no to-do list the header is the only line, so it carries the latest action the way a step's row does.
    const doing = c.tasks.length === 0 ? c.actions.findLast(a => !a.isHelper) : undefined
    const doingCount = c.actions.filter(a => !a.isHelper).length
    let header = doing ? (
      <Box flexDirection="row" flexShrink={1}>
        <Text bold color={PASTEL.working}>{'✱ Working…'}</Text>
        <Box flexDirection="row" flexShrink={1} marginLeft={1}>
          <Text dimColor wrap="truncate-end">{`· ${doing.icon} ${doing.detail || doing.label}`}</Text>
          {doing.isFailed && (
            <Box flexShrink={0}>
              <Text color={PASTEL.error}>{" · didn't work"}</Text>
            </Box>
          )}
          {doingCount > 1 && (
            <Box flexShrink={0}>
              <Text dimColor>{` · ${doingCount} actions`}</Text>
            </Box>
          )}
        </Box>
      </Box>
    ) : (
      <Text bold color={PASTEL.working} wrap="truncate-end">
        {c.tasks.length === 0 ? '✱ Working…' : `✱ ${DEFAULT_TITLE}`}
      </Text>
    )
    if (c.phase === 'needsYou') {
      header = (
        <Text color={PASTEL.waiting} wrap="truncate-end">
          {`? Needs you · ${c.needsYouReason ?? REASON_REPLY}`}
        </Text>
      )
    } else if (c.phase === 'stuck') {
      header = (
        <Text color={PASTEL.stuck} wrap="truncate-end">
          {`⚠ Stuck: ${c.stuckReason ?? STUCK_FAILING}`}
        </Text>
      )
    } else if (c.phase === 'stopped') {
      header = (
        <Text color={PASTEL.stuck} wrap="truncate-end">
          {'■ Stopped · you pressed Esc'}
        </Text>
      )
    } else if (c.phase === 'done') {
      header = (
        <Text color={PASTEL.done} wrap="truncate-end">
          {`✓ All done${c.tasks.length === 0 ? '' : ` · ${c.tasks.length} step${c.tasks.length === 1 ? '' : 's'}`}`}
        </Text>
      )
    }

    const showsTime = c.phase !== 'idle'
    const headerRow = (
      <Box key="clean-view-header" flexDirection="row" justifyContent="space-between" flexWrap={isTerminal ? 'nowrap' : 'wrap'}>
        <Box flexGrow={1} flexShrink={1}>
          {header}
        </Box>
        <Box flexDirection="row" flexShrink={0}>
          {showsTime && <Text dimColor>{`${c.phase === 'done' ? `took ${elapsed}` : elapsed}  `}</Text>}
          {buttons}
        </Box>
      </Box>
    )
    const waitsForReply = c.phase === 'needsYou' && c.question !== ''
    // What Claude is asking, and one-press answers where the question has clear options.
    const askRows = waitsForReply
      ? [
          <Box key="clean-view-question" flexShrink={1}>
            <Text wrap="wrap">{c.question}</Text>
          </Box>,
          c.replies.length > 0 ? (
            <Box key="clean-view-replies" flexDirection="row" flexWrap="wrap" gap={1}>
              {c.replies.map((reply, i) => (
                <Button
                  key={`clean-view-reply-${i}`}
                  label={reply.label}
                  variant={i === 0 ? 'primary' : 'secondary'}
                  onPress={() => {
                    // Sent as the person's own words; the job carries on from it.
                    void $.prompt.submit({ text: reply.text, asUser: true })
                  }}
                />
              ))}
            </Box>
          ) : null,
        ]
      : []
    // The frame keeps the checklist apart from the reply; its colour says how the job stands.
    const frameColor =
      c.phase === 'done'
        ? PASTEL.done
        : c.phase === 'needsYou'
          ? PASTEL.waiting
          : c.phase === 'stuck'
            ? PASTEL.stuck
            : c.phase === 'stopped'
              ? PASTEL.stuck // stuck and stopped are both a problem to look at, so they share yellow
              : PASTEL.working
    const frame = (children: RenderChildren) => (
      <Box key="clean-view-frame" flexDirection="column" borderStyle="round" borderColor={frameColor} paddingX={1}>
        {children}
      </Box>
    )
    if (c.phase === 'done' && c.isCollapsed) {
      return (
        <Box flexDirection="column">
          {frame([headerRow])}
          {below}
        </Box>
      )
    }

    // A finished job lists every step, so nothing is folded into "N earlier steps done".
    const { start: windowStart, end: windowEnd } = c.phase === 'done' ? { start: 0, end: c.tasks.length } : stepWindow(c.tasks)

    const nameWidth = Math.max(8, Math.min(MAX_NAME, width - 24))
    const firstUpcoming = c.tasks.findIndex(t => t.status === 'upcoming')
    const latest = c.actions.findLast(a => !a.isHelper)
    const showsTrail = mode === 'guided' && latest !== undefined && c.phase !== 'done'
    // The latest action sits on the step's own row, after its name. The terminal's name column then spans the room
    // to the bar (icon, bar and label take the rest), so every row's bar stays aligned.
    const terminalNameCells = showsTrail ? Math.max(nameWidth + 1, width - (2 + METER + LABEL_CELLS) - 1) : nameWidth + 1

    const rows = c.tasks.flatMap((task, i) => {
      if (i < windowStart || i >= windowEnd) return []
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
      const count = c.actions.filter(a => a.step === task.name).length
      const hasTrail = isActive && showsTrail && latest !== undefined
      const trailText = latest ? `${latest.icon} ${latest.detail || latest.label}` : ''
      const row = (
        <Box key={`task-${task.id}`} flexDirection="row" alignItems="center">
          <Text color={task.status === 'done' ? PASTEL.done : isActive ? PASTEL.working : undefined} dimColor={task.status === 'upcoming'}>
            {`${icon} `}
          </Text>
          <Box key="name" {...(isTerminal ? { width: terminalNameCells, flexShrink: 0 } : { flexGrow: 1, flexShrink: 1 })}>
            <Text bold={isActive} dimColor={!isActive} wrap="truncate-end">
              {trimToWidth(task.name, nameWidth)}
            </Text>
            {hasTrail && latest && (
              <Box key="clean-view-trail" flexDirection="row" flexShrink={1} marginLeft={1}>
                <Text dimColor wrap="truncate-end">{`· ${trailText}`}</Text>
                {latest.isFailed && (
                  <Box flexShrink={0}>
                    <Text color={PASTEL.error}>{" · didn't work"}</Text>
                  </Box>
                )}
                {count > 1 && (
                  <Box flexShrink={0}>
                    <Text dimColor>{` · ${count} actions`}</Text>
                  </Box>
                )}
              </Box>
            )}
          </Box>
          <Box key="meter" flexDirection="row" flexShrink={0}>
            {Svg ? (
              <Svg
                key={`meter-${task.id}`}
                source={barSvg(meterCells(task, tick), task.status === 'done' ? PASTEL.done : PASTEL.working)}
                alt={label}
                width={METER * BAR_CELL_PX}
                height={BAR_BOX_PX}
              />
            ) : (
              meterRuns(meterCells(task, tick)).map((run, r) => (
                <Text key={`meter-${task.id}-${r}`} color={!run.lit ? 'subtle' : task.status === 'done' ? PASTEL.done : PASTEL.working}>
                  {run.text}
                </Text>
              ))
            )}
          </Box>
          <Box key="label" width={LABEL_CELLS} flexShrink={0} paddingLeft={2}>
            <Text dimColor={!isActive}>{label}</Text>
          </Box>
        </Box>
      )
      return [row]
    })

    // What the window leaves out, in one line: finished steps above it, steps still to come below it.
    const hiddenDone = windowStart
    const hiddenToCome = c.tasks.length - windowEnd
    const hiddenText = [hiddenDone > 0 ? `✓ ${hiddenDone} earlier step${hiddenDone === 1 ? '' : 's'} done` : '', hiddenToCome > 0 ? `${hiddenToCome} more to come` : '']
      .filter(part => part !== '')
      .join(' · ')
    const moreRow = hiddenText === '' ? null : (
      <Box key="clean-view-more" flexDirection="row" paddingLeft={2}>
        <Text dimColor>{hiddenText}</Text>
      </Box>
    )

    return (
      <Box flexDirection="column">
        {frame([headerRow, ...askRows, ...rows, moreRow])}
        {below}
      </Box>
    )
  })

  // The colour legend: each frame colour the checklist uses, and when it shows.
  on('ui.render', { component: 'Pane', requestId: COLOURS_PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    // One frame as the checklist draws it, with a line on when it appears.
    const frame = (key: string, color: string, header: RenderChildren, when: string) => (
      <Box key={key} flexDirection="column" borderStyle="round" borderColor={color} paddingX={1}>
        {header}
        <Text dimColor wrap="wrap">
          {when}
        </Text>
      </Box>
    )
    return (
      <Box flexDirection="column" gap={1}>
        {frame(
          'state-working',
          PASTEL.working,
          <Text bold color={PASTEL.working} wrap="wrap">{'✱ Working on your request'}</Text>,
          'Orange: Claude is working through the steps.',
        )}
        {frame(
          'state-waiting',
          PASTEL.waiting,
          <Text color={PASTEL.waiting} wrap="wrap">{'? Needs you · Claude is waiting for your reply'}</Text>,
          'Blue: Claude asked you something, or needs an OK, and is waiting.',
        )}
        {frame(
          'state-stuck',
          PASTEL.stuck,
          <Text color={PASTEL.stuck} wrap="wrap">{'⚠ Stuck: a step keeps failing'}</Text>,
          'Yellow: a step keeps failing, you refused one, or an error stopped the job.',
        )}
        {frame(
          'state-done',
          PASTEL.done,
          <Text color={PASTEL.done} wrap="wrap">{'✓ All done'}</Text>,
          'Green: the job finished with nothing left to ask.',
        )}
        {frame(
          'state-stopped',
          PASTEL.stuck,
          <Text color={PASTEL.stuck} wrap="wrap">{'■ Stopped · you pressed Esc'}</Text>,
          'Yellow: you interrupted the job.',
        )}
      </Box>
    )
  })

  // The Details pane: every step of the job and every action under it, in full.
  on('ui.render', { component: 'Pane', requestId: DETAILS_PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const c = await read($, checklistAtom)
    const now = await $.clock.now()

    if (c.startedAt === null) {
      return (
        <Box flexDirection="column">
          <Text dimColor>Nothing yet. Once Claude starts a job, every step and action shows here.</Text>
        </Box>
      )
    }

    const elapsed = formatDuration((c.finishedAt ?? now) - c.startedAt)
    const failed = c.actions.filter(a => a.isFailed).length
    const summary = [
      `${c.actions.length} action${c.actions.length === 1 ? '' : 's'}`,
      failed > 0 ? `${failed} error${failed === 1 ? '' : 's'}` : null,
      elapsed,
    ]
      .filter(Boolean)
      .join(' · ')

    const groups = detailGroups(c).flatMap(group => {
      const isActive = group.status === 'active'
      const icon = group.status === 'done' ? '✓' : isActive ? '▶' : '○'
      const color = group.status === 'done' ? PASTEL.done : isActive ? PASTEL.working : undefined
      const head = (
        <Box key={`step-${group.step}`} flexDirection="row" marginTop={1}>
          <Text color={color} dimColor={group.status === 'upcoming'}>{`${icon} `}</Text>
          <Text bold={group.status !== 'upcoming'} dimColor={group.status === 'upcoming'}>
            {group.step || 'Getting started'}
          </Text>
          {group.actions.length > 0 && <Text dimColor>{`  ${group.actions.length}`}</Text>}
        </Box>
      )
      const lines = group.actions.map(a => (
        <Box key={`action-${a.id}`} flexDirection="column" paddingLeft={2}>
          <Box flexDirection="row">
            <Box flexDirection="row" flexShrink={0}>
              <Text>{`${a.isHelper ? '🤖 ' : ''}${a.icon} `}</Text>
              <Text>{a.label}</Text>
            </Box>
            {a.detail !== '' && <Text dimColor wrap="truncate-end">{` · ${a.detail}`}</Text>}
            {a.isFailed && (
              <Box flexShrink={0}>
                <Text color={PASTEL.error}>{" · didn't work"}</Text>
              </Box>
            )}
          </Box>
          {a.full !== '' && a.full !== a.detail && (
            <Box paddingLeft={3}>
              <Text color="subtle" wrap="wrap">
                {a.full}
              </Text>
            </Box>
          )}
          {a.output !== '' && (
            <Box key={`output-${a.id}`} paddingLeft={3}>
              <Text color={a.isFailed ? PASTEL.error : 'subtle'} wrap="wrap">
                {a.output}
              </Text>
            </Box>
          )}
          {a.output === '' && a.note !== '' && (
            <Box paddingLeft={3}>
              <Text color={PASTEL.error} wrap="wrap">
                {a.note}
              </Text>
            </Box>
          )}
        </Box>
      ))
      return [head, ...lines]
    })

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" justifyContent="space-between" flexWrap={e.surface === 'terminal' ? 'nowrap' : 'wrap'}>
          <Box flexDirection="row" flexShrink={1}>
            <Text bold color={PASTEL.working} wrap="truncate-end">
              Your request
            </Text>
            <Text dimColor>{`  ${summary}`}</Text>
          </Box>
        </Box>
        {groups}
      </Box>
    )
  })

  // Tool rows in the transcript: hidden while Clean View is on, unless the
  // Details pane asked for them back.
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    if (await read($, showsToolRowsAtom)) return next(e)
    const { Box } = $.ui.resolve(e)
    return <Box />
  })

  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    if (await read($, showsToolRowsAtom)) return next(e)
    const { Box } = $.ui.resolve(e)
    return <Box />
  })

  // A folded group is one summary line (`Ran 2 commands`) the desktop draws
  // itself around whatever a hook returns, so off the terminal the group is
  // unfolded into its rows, each of which the ToolUse hook above empties.
  on('ui.render', { component: 'ToolGroup' }, async ($, e, next) => {
    if (await read($, showsToolRowsAtom)) return next(e)
    if (e.surface !== 'terminal') return next({ ...e, props: { ...e.props, isExpanded: true } })
    const { Box } = $.ui.resolve(e)
    return <Box />
  })

  // The spinner line carries Claude Code's own to-do rows beneath it, which the
  // checklist above the prompt already shows, so with a real plan it is cut to the word.
  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    if (e.surface !== 'terminal' || (await read($, modeAtom)) !== 'guided' || !(await read($, checklistAtom)).hasRealPlan) return next(e)
    const { Text } = $.ui.resolve(e)
    return <Text color={PASTEL.working}>{`${e.props.message ?? e.props.word}${e.props.suffix}`}</Text>
  })

  // A helper agent's hand-back ("Message from @Explore") and the "Agent finished" line are
  // plumbing: Claude reads them and answers in its own words. A task that failed or was
  // stopped keeps its row, so a problem never goes quiet.
  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    if (await read($, showsToolRowsAtom)) return next(e)
    const { from, task } = e.props
    const isPlumbing = from !== undefined || (task !== undefined && task.status !== 'failed' && task.status !== 'killed')
    if (!isPlumbing) return next(e)
    const { Box } = $.ui.resolve(e)
    return <Box />
  })

  // What Claude writes between tool calls ("Now the fix for...") is narration: the answer is
  // the text of a step that calls no tool. A step that did call one has its text remembered
  // here, and the transcript hides it. The checklist and Details already tell that story.
  on('turn.step', async function* ($, e, next) {
    const response = yield* next(e)
    const text = response.answer.trim()
    if (e.agentId === undefined && text !== '' && response.toolUses.length > 0) {
      await update($, narrationAtom, list => [...list.slice(-199), text])
    }
    return response
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (await read($, showsToolRowsAtom)) return next(e)
    const text = e.props.text.trim()
    const isNarration = text !== '' && (await read($, narrationAtom)).some(n => n.includes(text))
    if (!isNarration) return next(e)
    const { Box } = $.ui.resolve(e)
    return <Box />
  })

  on('ui.render', { component: 'ToolProgress' }, async ($, e, next) => {
    if (await read($, showsToolRowsAtom)) return next(e)
    return next({ ...e, props: { ...e.props, hint: '' } })
  })
}
