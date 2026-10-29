// Clean View: a calm checklist above the prompt in place of the technical
// tool rows, which it hides from the transcript along with Claude's own notes
// between tool calls. The checklist shows the latest action on the step in
// progress and the latest note; the Details pane lists every step, action and
// note of the job in full. Switched off, Claude Code is left as it is.
//
// This file is the hooks; the rest sits beside it: state.ts (values and names),
// checklist.ts (how a job changes), bars.ts, box.tsx and panes.tsx (drawing).

import { atom, derive, read, update } from 'claude-code'
import type { Chunk, EngineInterface, Register, Timer } from 'claude-code'

import type { Checklist, ChecklistTask } from '../types'
import { drawBox } from './box'
import {
  alertText, applyPlanStep, applyTodos, asksSomething, clearNeedsYou, currentStep, hasUnfinished, isRunningPhase,
  markFailed, newId, outputOf, plannedTodos, recordAction, recordNote, rehomeNote, setNeedsYou, setOutput, setStuck, startFirstUpcoming,
  titleFor, trackSteps,
} from './checklist'
import { COMMANDS } from './info'
import { drawDetails, followDetails, keepInView, noteScroll } from './panes'
import { PASTEL } from './palette'
import {
  DEFAULT_TITLE, DETAILS_PANE, EMPTY, REASON_PERMISSION, REASON_QUESTION, REASON_REPLY, STORE_ALERTS, STORE_ON,
  STUCK_FAILING, STUCK_REFUSAL, STUCK_REFUSED,
} from './state'
import { apiErrorSentence, cleanName, describeAction, describeFull, firstLine, isUserRefusal } from './text'

// Values the drawings read (types/index.d.ts). `isOn` is saved in $.store too, so it lasts past the session;
// the toolbox reads it. They are declared here because the engine reads and writes them from this file only.
const isOnAtom = atom({ plugin: 'clean-view', key: 'isOn' } as const, true)
const checklistAtom = atom({ plugin: 'clean-view', key: 'checklist' } as const, EMPTY)
const tickAtom = atom({ plugin: 'clean-view', key: 'tick' } as const, 0)
const narrationAtom = atom({ plugin: 'clean-view', key: 'narration' } as const, [] as string[])
const showsAllAtom = atom({ plugin: 'clean-view', key: 'showsAll' } as const, false)
const errorsOnlyAtom = atom({ plugin: 'clean-view', key: 'errorsOnly' } as const, false)

/** Clean View off leaves the transcript as the engine draws it: tool rows, notes and all. */
const isOffAtom = derive([isOnAtom], isOn => !isOn)

const PLAN_TOOL = 'mcp__ccd_turn__update_plan'
/** A job shorter than this ends without an alert: the person is still looking. */
const ALERT_AFTER_MS = 20_000
const TICK_MS = 250
const COLLAPSE_MS = 5000
const FAILS_BEFORE_STUCK = 3

// Module state: rebuilt on every reload (session.start fires again then).
let ticker: Timer | undefined
let failStreak = 0
let isCommandPrompt = false
let lastApiError: { kind?: string; details?: string } | undefined
/** The note said before the tool calls now running, filed under its step once they are done (see rehomeNote). */
let pendingNote: string | undefined

const shouldTick = (c: Checklist, isOn: boolean) => isOn && isRunningPhase(c)

function stopTicker() {
  ticker?.cancel()
  ticker = undefined
}

/** The helper agents running now, for the box's light. */
async function runningHelpers($: EngineInterface): Promise<number> {
  try {
    return (await $.agent.list()).filter(a => a.status === 'running' && a.teammateId === undefined).length
  } catch {
    return 0 // a host without agents
  }
}

/** A native notification where the terminal has a channel for one, else a toast. */
async function alertPerson($: EngineInterface, text: string) {
  try {
    if ((await $.ui.notify(text, { title: 'Clean View' })).isSent) return
  } catch {
    // The channel failed to write; the toast below says it instead.
  }
  $.ui.toast(text)
}

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
    if (arg === 'alerts on' || arg === 'alerts off') {
      const isOn = arg === 'alerts on'
      await $.store.set(STORE_ALERTS, isOn)
      return { text: isOn ? `Alerts are on: a notification when a job of ${ALERT_AFTER_MS / 1000} seconds or more finishes, gets stuck or needs you.` : 'Alerts are off.' }
    }
    if (arg === 'on' || arg === 'off' || arg === 'full') {
      const isOn = arg === 'on'
      await update($, isOnAtom, () => isOn)
      await $.store.set(STORE_ON, isOn)
      return { text: isOn ? 'Clean View is on.' : 'Clean View is off. Everything Claude does is shown in full.' }
    }
    return { text: 'Use /view on, /view off or /view alerts on|off.' }
  })

  on('prompt.submit', (_$, e, next) => {
    isCommandPrompt = e.command !== undefined
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') $.clock.after(200, () => void restoreAfterClear($))
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    await restoreAfterClear($)
    const started = await next(e)
    if (e.agentId !== undefined) return started

    const isOn = !(await read($, isOffAtom))
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
      await followDetails($)
      if (shouldTick(written, isOn) && !ticker) {
        ticker = $.clock.every(TICK_MS, async () => {
          const [list, isOff] = await Promise.all([read($, checklistAtom), read($, isOffAtom)])
          if (shouldTick(list, !isOff)) await update($, tickAtom, n => n + 1)
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
    if (e.agentId !== undefined) {
      // A helper agent's call: kept for the Details pane, nothing else.
      const summary = describeAction(tool, e)
      if (!summary) return next(e)
      const id = e.tool_use_id ?? newId('a')
      const helperStart = await $.clock.now()
      await update($, checklistAtom, c =>
        isRunningPhase(c)
          ? recordAction(c, { id, ...summary, full: describeFull(tool, e), step: currentStep(c), isHelper: true, isFailed: false, note: '', output: '', startedAt: helperStart })
          : c,
      )
      const ran = await next(e)
      const output = outputOf(tool, ran)
      const helperEnd = await $.clock.now()
      const isFailed = ran.deny !== undefined || ran.isError === true
      const note = isFailed ? firstLine(ran.deny ?? ran.text) : ''
      await update($, checklistAtom, c => {
        const answered = setOutput(c, id, output, helperEnd)
        return isFailed ? markFailed(answered, id, note) : answered
      })
      return ran
    }

    const summary = describeAction(tool, e)
    const actionId = e.tool_use_id ?? newId('a')
    const actionStart = await $.clock.now()
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
          startedAt: actionStart,
        })
      }
      return changed
    })
    await keepInView($)

    const ran = await next(e)
    const isFailed = ran.deny !== undefined || ran.isError === true
    const failText = ran.deny ?? (ran.isError ? ran.text : undefined)
    const output = outputOf(tool, ran)
    const now = await $.clock.now()

    await update($, checklistAtom, c => {
      let changed = setOutput(c, actionId, output, now)
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
      return trackSteps(changed, now)
    })

    failStreak = !isFailed || isUserRefusal(failText) ? 0 : failStreak + 1
    await keepInView($)
    return ran
  }).catch((_$, e, next) => next(e))

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
      return trackSteps({ ...c, tasks, phase: 'done', needsYouReason: null, stuckReason: null, finishedAt: now, isCollapsed: false }, now)
    })

    if (!shouldTick(written, !(await read($, isOffAtom)))) stopTicker()
    const alert = written.startedAt !== null && now - written.startedAt >= ALERT_AFTER_MS ? alertText(written) : null
    if (alert !== null && !(await read($, isOffAtom)) && (await $.store.get(STORE_ALERTS)) !== false) await alertPerson($, alert)
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
    const c = await read($, checklistAtom)
    if (e.props.hasSurvey || (await read($, isOffAtom)) || c.phase === 'idle' || c.startedAt === null) return next(e)
    return drawBox($, e, c, { startedAt: c.startedAt, tick: await read($, tickAtom), helpers: await runningHelpers($), below: await next(e) })
  })

  // Whether the person has scrolled Details away from its newest lines, so it is not pulled back.
  on('ui.scroll', { requestId: DETAILS_PANE }, async (_$, e, next) => {
    noteScroll(e)
    return next(e)
  })

  // The Details pane.
  on('ui.render', { component: 'Pane', requestId: DETAILS_PANE }, async ($, e) => {
    return drawDetails($, e, await read($, checklistAtom), {
      showsAll: await read($, showsAllAtom),
      errorsOnly: await read($, errorsOnlyAtom),
      toggleAll: () => void update($, showsAllAtom, shown => !shown),
      toggleErrors: () => void update($, errorsOnlyAtom, shown => !shown),
    })
  })

  // Tool rows in the transcript: hidden while Clean View is on.
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    if (await read($, isOffAtom)) return next(e)
    const { Box } = $.ui.resolve(e)
    return <Box />
  })

  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    if (await read($, isOffAtom)) return next(e)
    const { Box } = $.ui.resolve(e)
    return <Box />
  })

  // A folded group is one summary line (`Ran 2 commands`) the desktop draws
  // itself around whatever a hook returns, so off the terminal the group is
  // unfolded into its rows, each of which the ToolUse hook above empties.
  on('ui.render', { component: 'ToolGroup' }, async ($, e, next) => {
    if (await read($, isOffAtom)) return next(e)
    if (e.surface !== 'terminal') return next({ ...e, props: { ...e.props, isExpanded: true } })
    const { Box } = $.ui.resolve(e)
    return <Box />
  })

  // The spinner line carries Claude Code's own to-do rows beneath it, which the
  // checklist above the prompt already shows, so with a real plan it is cut to the word.
  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    if (e.surface !== 'terminal' || (await read($, isOffAtom)) || !(await read($, checklistAtom)).hasRealPlan) return next(e)
    const { Text } = $.ui.resolve(e)
    return <Text color={PASTEL.working}>{`${e.props.message ?? e.props.word}${e.props.suffix}`}</Text>
  })

  // A helper agent's hand-back ("Message from @Explore") and the "Agent finished" line are
  // plumbing: Claude reads them and answers in its own words. A task that failed or was
  // stopped keeps its row, so a problem never goes quiet.
  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    if (await read($, isOffAtom)) return next(e)
    const { from, task } = e.props
    const isPlumbing = from !== undefined || (task !== undefined && task.status !== 'failed' && task.status !== 'killed')
    if (!isPlumbing) return next(e)
    const { Box } = $.ui.resolve(e)
    return <Box />
  })

  // What Claude writes between tool calls ("Now the fix for...") is narration: the closing
  // answer is the text of a step that calls no tool. Which one a step's text is only shows
  // when the step ends, so once text starts the step's pieces are held back until then; a
  // narration is remembered before it is let through, and the transcript never draws it.
  // The cost is that an answer appears whole instead of typing out.
  on('turn.step', async function* ($, e, next) {
    if (e.agentId !== undefined || (await read($, isOffAtom))) return yield* next(e)
    if (pendingNote !== undefined) {
      const id = pendingNote
      pendingNote = undefined
      await update($, checklistAtom, c => rehomeNote(c, id))
    }
    const held: Chunk<'turn.step'>[] = []
    const stream = next(e)[Symbol.asyncIterator]()
    let step = await stream.next()
    while (!step.done) {
      if (held.length > 0 || step.value.kind === 'text') held.push(step.value)
      else yield step.value
      step = await stream.next()
    }
    const response = step.value
    const text = response.answer.trim()
    if (text !== '' && response.toolUses.length > 0) {
      await update($, narrationAtom, list => [...list.slice(-199), text])
      pendingNote = newId('note')
      const id = pendingNote
      await update($, checklistAtom, c => (c.startedAt === null ? c : recordNote(c, id, text)))
      await keepInView($)
    }
    for (const chunk of held) yield chunk
    return response
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (await read($, isOffAtom)) return next(e)
    const text = e.props.text.trim()
    // The engine folds text between tool calls into a faint "summary" block of its own wording,
    // which no remembered step text can match; a closing answer is never one.
    const isNarration = e.props.isSummary === true || (text !== '' && (await read($, narrationAtom)).some(n => n.includes(text)))
    if (!isNarration) return next(e)
    const { Box } = $.ui.resolve(e)
    return <Box />
  })

  on('ui.render', { component: 'ToolProgress' }, async ($, e, next) => {
    if (await read($, isOffAtom)) return next(e)
    return next({ ...e, props: { ...e.props, hint: '' } })
  })
}

