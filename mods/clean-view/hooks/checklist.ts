// The checklist as a value: every change to a job is a pure function from one Checklist to the next.

import type { Checklist, ChecklistAction, ChecklistTask } from '../types'
import { DEFAULT_TITLE, STUCK_FAILING, STUCK_REFUSED } from './state'
import { cleanName, clipOutput, extractQuestion, quickReplies } from './text'

const MAX_ACTIONS = 300
/** A running action shows its own clock after this long. */
const SLOW_AFTER_MS = 5000

let idCounter = 0

export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(idCounter++).toString(36)}`
export const isRunningPhase = (c: Checklist) => c.phase === 'working' || c.phase === 'needsYou' || c.phase === 'stuck'
export const hasUnfinished = (c: Checklist) => c.tasks.some(t => t.status !== 'done')

export function startFirstUpcoming(tasks: ChecklistTask[]): ChecklistTask[] {
  if (tasks.some(t => t.status === 'active')) return tasks
  const i = tasks.findIndex(t => t.status === 'upcoming')
  return i < 0 ? tasks : tasks.map((t, j) => (j === i ? { ...t, status: 'active', percent: 0 } : t))
}

/** The header names the job after its first step once a plan arrives, until then it keeps the placeholder. */
export const titleFor = (c: Checklist, tasks: readonly ChecklistTask[]) => (c.title === DEFAULT_TITLE && tasks[0] ? tasks[0].name : c.title)

type Todo = { content: string; status: 'pending' | 'in_progress' | 'completed' }

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
  return { ...c, tasks, title: titleFor(c, tasks), hasRealPlan: tasks.length > 0 || c.hasRealPlan }
}

/** Whether the last paragraph of an answer ends in a question, the sign Claude is waiting for the person. */
export function asksSomething(answer: string): boolean {
  const last = answer.trim().split(/\n\s*\n/).pop() ?? ''
  return /\?[\s"'”)*_`]*$/.test(last.trim())
}

export function setNeedsYou(c: Checklist, reason: string, answer = ''): Checklist {
  return { ...c, phase: 'needsYou', needsYouReason: reason, question: extractQuestion(answer), replies: answer === '' ? [] : quickReplies(answer) }
}

export function clearNeedsYou(c: Checklist): Checklist {
  return c.phase === 'needsYou' ? { ...c, phase: 'working', needsYouReason: null, question: '', replies: [] } : c
}

export function setStuck(c: Checklist, reason: string): Checklist {
  return { ...c, phase: 'stuck', stuckReason: reason, needsYouReason: null }
}

export function recordAction(c: Checklist, action: ChecklistAction): Checklist {
  return { ...c, actions: [...c.actions.filter(a => a.id !== action.id), action].slice(-MAX_ACTIONS) }
}

/** A note as one line: its first sentence, which is what fits in the box. */
export const firstSentence = (text: string) => {
  const paragraph = (text.split(/\n\s*\n/)[0] ?? '').replace(/\s+/g, ' ').trim()
  return paragraph.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? paragraph
}

export function recordNote(c: Checklist, id: string, text: string): Checklist {
  const step = currentStep(c)
  const note = { id, text, step, before: c.actions.filter(a => a.step === step).length }
  return { ...c, notes: [...c.notes, note].slice(-100) }
}

/** The header of a job that waits for the person: `Waiting for you`, and why when it is more than a reply. */
export const waitingText = (c: Checklist) => (c.needsYouReason ? `Waiting for you · ${c.needsYouReason}` : 'Waiting for you')

/** The header of a job that cannot go on: `Paused` when the person refused a step, else `Stuck`, with the reason. */
export function stuckText(c: Checklist): string {
  const reason = c.stuckReason ?? STUCK_FAILING
  return `${reason === STUCK_REFUSED ? 'Paused' : 'Stuck'} · ${reason}`
}

/** What to tell the person when a job ends where it needs them, or null when there is nothing to say (a stop they asked for). */
export function alertText(c: Checklist): string | null {
  if (c.phase === 'done') return c.tasks.length > 0 ? `All done · ${c.tasks.length} step${c.tasks.length === 1 ? '' : 's'}` : 'All done'
  if (c.phase === 'needsYou') return c.question !== '' ? c.question.slice(0, 200) : waitingText(c)
  if (c.phase === 'stuck') return stuckText(c)
  return null
}

/** Notes when each step began and ended, as the plan moves on. */
export function trackSteps(c: Checklist, now: number): Checklist {
  let times = c.times
  for (const t of c.tasks) {
    if (t.status === 'upcoming') continue
    const seen = times[t.name]
    if (!seen) times = { ...times, [t.name]: t.status === 'done' ? { start: now, end: now } : { start: now } }
    else if (t.status === 'done' && seen.end === undefined) times = { ...times, [t.name]: { ...seen, end: now } }
  }
  return times === c.times ? c : { ...c, times }
}

/** Tools that only confirm a success ("File created…", "Agent launched…"): Details leaves that out, keeping any error. */
const QUIET_WHEN_OK = new Set(['Agent', 'Write', 'Edit', 'NotebookEdit'])

export function outputOf(tool: string, ran: { deny?: string; isError?: boolean; text?: unknown }): string {
  const failed = ran.deny !== undefined || ran.isError === true
  return QUIET_WHEN_OK.has(tool) && !failed ? '' : clipOutput(ran.deny ?? ran.text)
}

/**
 * A note comes ahead of the tool calls it introduces, so it is filed under the step in progress when it was said.
 * Once those calls have run, a plan that moved on makes it the opening of the new step.
 */
export function rehomeNote(c: Checklist, id: string): Checklist {
  const step = currentStep(c)
  return { ...c, notes: c.notes.map(n => (n.id === id && n.step !== step ? { ...n, step, before: 0 } : n)) }
}

export function markFailed(c: Checklist, id: string, note: string): Checklist {
  return { ...c, actions: c.actions.map(a => (a.id === id ? { ...a, isFailed: true, note } : a)) }
}

export function setOutput(c: Checklist, id: string, output: string, endedAt: number): Checklist {
  return { ...c, actions: c.actions.map(a => (a.id === id ? { ...a, output, endedAt } : a)) }
}

/** The failed actions as plain text to paste: what ran, then what it answered. */
export function errorReport(c: Checklist): string {
  return c.actions
    .filter(a => a.isFailed)
    .map(a => [`${a.label}${a.full ? `: ${a.full}` : a.detail ? `: ${a.detail}` : ''}`, a.output || a.note].filter(Boolean).join('\n'))
    .join('\n\n')
}

/** How long an action that has not answered yet has been running, once it is long enough to notice. */
export function runningFor(a: ChecklistAction | undefined, now: number): number | null {
  if (!a || a.startedAt === undefined || a.endedAt !== undefined) return null
  return now - a.startedAt >= SLOW_AFTER_MS ? now - a.startedAt : null
}

/** The step a new action belongs to: the one in progress, else the last one started. */
export function currentStep(c: Checklist): string {
  const active = c.tasks.find(t => t.status === 'active')
  return active?.name ?? [...c.tasks].reverse().find(t => t.status === 'done')?.name ?? ''
}

/**
 * The steps in the order the Details pane lists them: steps that only actions
 * remember (the placeholders before a plan) first, then the plan.
 */
export function detailGroups(c: Checklist): { step: string; status: ChecklistTask['status']; actions: ChecklistAction[] }[] {
  const planned = new Set(c.tasks.map(t => t.name))
  const earlier = [...new Set([...c.actions, ...c.notes].map(a => a.step).filter(step => !planned.has(step)))]
  return [
    ...earlier.map(step => ({ step, status: 'done' as const, actions: c.actions.filter(a => a.step === step) })),
    ...c.tasks.map(t => ({ step: t.name, status: t.status, actions: c.actions.filter(a => a.step === t.name) })),
  ]
}
