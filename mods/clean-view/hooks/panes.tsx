// The Details pane: every step, action and note of the job.

import type { EngineInterface } from 'claude-code'

import type { Checklist, ChecklistAction } from '../types'
import { detailGroups, errorReport, isRunningPhase } from './checklist'
import { PASTEL } from './palette'
import type { RenderEvent } from './render'
import { DETAILS_PANE, DETAILS_TITLE } from './state'
import { formatDuration } from './text'

/** The key of an action's row in Details, which the box's Show error button scrolls to. */
const actionKey = (id: string) => `action-${id}`

/**
 * Opens Details at its newest lines, or at one action (`actionId`). The engine keeps the bottom in view as the
 * pane grows until the person scrolls; the next job asks again.
 */
export async function openDetails($: EngineInterface, actionId?: string) {
  const opened = await $.ui.open({ id: DETAILS_PANE, title: DETAILS_TITLE })
  if (actionId === undefined) await followDetails($)
  else await scrollDetails($, { to: { key: actionKey(actionId) }, block: 'center' })
  return opened
}

async function scrollDetails($: EngineInterface, where: { to: 'end' | { key: string }; block?: 'center' }) {
  try {
    await $.ui.scroll({ in: DETAILS_PANE, ...where })
  } catch {
    // No pane to move (not open, or a headless host): nothing to scroll.
  }
}

export function followDetails($: EngineInterface) {
  isFollowing = true
  return scrollDetails($, { to: 'end' })
}

/**
 * Whether Details should stay at its newest lines: yes until the person scrolls away from the end, and again
 * once they scroll back to it. The terminal follows the end by itself; the desktop app may not, so the
 * hooks ask for the end again whenever Details has grown.
 */
let isFollowing = true

/** Reads a scroll of Details: only the person's move changes whether it follows. */
export function noteScroll(e: { origin: { kind: string }; offset: number; bodyRows: number; contentRows: number }) {
  if (e.origin.kind !== 'person') return
  isFollowing = e.offset >= e.contentRows - e.bodyRows
}

/** Brings Details back to its newest lines after it grew, if it is open and the person has not scrolled away. */
export async function keepInView($: EngineInterface) {
  if (!isFollowing) return
  try {
    if ((await $.ui.panes()).some(pane => pane.id === DETAILS_PANE)) await scrollDetails($, { to: 'end' })
  } catch {
    // No panes to read (a headless host): nothing to keep in view.
  }
}

/** Puts every failed action, with what it answered, on the clipboard, and says whether it took. */
async function copyErrors($: EngineInterface, e: RenderEvent<'Pane'>, c: Checklist) {
  const copied = await $.ui.copy({ text: errorReport(c), surface: e.surface })
  await $.ui.toast(copied.isCopied ? 'Errors copied' : 'Could not copy the errors')
}

/** How Details is set: the person's two switches, and what pressing each does. */
type DetailsView = { showsAll: boolean; errorsOnly: boolean; toggleAll: () => void; toggleErrors: () => void }

/** The Details pane: every step of the job and every action under it, in full. */
export async function drawDetails($: EngineInterface, e: RenderEvent<'Pane'>, c: Checklist, view: DetailsView) {
  const { Box, Text, Button } = $.ui.resolve(e)
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

  // Two weights of text: white names what happened (steps, actions), one grey carries what backs it up
  // (details, commands, answers, notes). Red is only for what went wrong.
  const noteRow = (n: Checklist['notes'][number]) => (
    <Box key={`note-${n.id}`} paddingLeft={2}>
      <Text dimColor italic wrap="wrap">{`💬 ${n.text}`}</Text>
    </Box>
  )
  const actionRow = (a: ChecklistAction) => {
    const result = a.output || a.note
    return (
      <Box key={actionKey(a.id)} flexDirection="column" paddingLeft={2}>
        <Box flexDirection="row">
          <Box flexDirection="row" flexShrink={0}>
            <Text>{`${a.isHelper ? '🤖 ' : ''}${a.icon} ${a.label}`}</Text>
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
            <Text dimColor wrap="wrap">{a.full}</Text>
          </Box>
        )}
        {result !== '' && (
          <Box paddingLeft={3}>
            <Text color={a.isFailed ? PASTEL.error : undefined} dimColor={!a.isFailed} wrap="wrap">{result}</Text>
          </Box>
        )}
      </Box>
    )
  }

  // While the job runs, steps that finished cleanly fold to their heading, so what is happening now is
  // what shows; a finished job, and any step with an error, list everything.
  const canFold = isRunningPhase(c) && c.tasks.length > 0
  const foldsFinished = canFold && !view.showsAll && !view.errorsOnly
  const groups = detailGroups(c).flatMap(group => {
    const isActive = group.status === 'active'
    const isUpcoming = group.status === 'upcoming'
    const icon = group.status === 'done' ? '✓' : isActive ? '▶' : '○'
    const color = group.status === 'done' ? PASTEL.done : isActive ? PASTEL.working : undefined
    const time = c.times[group.step]
    const took = time ? formatDuration((time.end ?? c.finishedAt ?? now) - time.start) : null
    const facts = [group.actions.length > 0 ? `${group.actions.length} action${group.actions.length === 1 ? '' : 's'}` : null, took].filter(Boolean).join(' · ')
    const head = (
      <Box key={`step-${group.step}`} flexDirection="row" marginTop={1}>
        <Text color={color} dimColor={isUpcoming}>{`${icon} `}</Text>
        <Text bold={!isUpcoming} dimColor={isUpcoming}>{group.step || 'Getting started'}</Text>
        {facts !== '' && <Text dimColor>{`  ${facts}`}</Text>}
      </Box>
    )
    if (view.errorsOnly) {
      const errors = group.actions.filter(a => a.isFailed)
      return errors.length === 0 ? [] : [head, ...errors.map(actionRow)]
    }
    if (foldsFinished && group.status === 'done' && !group.actions.some(a => a.isFailed)) return [head]
    const notes = c.notes.filter(n => n.step === group.step)
    return [
      head,
      // A note sits before the action it came ahead of; any later ones close the step.
      ...group.actions.flatMap((a, i) => [...notes.filter(n => n.before === i).map(noteRow), actionRow(a)]),
      ...notes.filter(n => n.before >= group.actions.length).map(noteRow),
    ]
  })

  return (
    <Box flexDirection="column">
      <Box flexDirection="row" justifyContent="space-between" flexWrap={e.surface === 'terminal' ? 'nowrap' : 'wrap'}>
        <Box flexDirection="column" flexShrink={1}>
          <Text bold color={PASTEL.working} wrap="truncate-end">
            Your request
          </Text>
          <Text dimColor wrap="wrap">{summary}</Text>
        </Box>
      </Box>
      {groups}
      {/* At the bottom, where the pane follows the newest lines, so it stays in view. */}
      {(canFold || failed > 0) && (
        <Box key="clean-view-switches" flexDirection="row" flexWrap="wrap" gap={1} marginTop={1}>
          {canFold && !view.errorsOnly && (
            <Button key="clean-view-fold" label={view.showsAll ? 'Fold finished' : 'Show all'} onPress={view.toggleAll} />
          )}
          {failed > 0 && (
            <Button key="clean-view-copy" label="Copy" onPress={() => copyErrors($, e, c)} />
          )}
          {failed > 0 && (
            <Button key="clean-view-errors" label={view.errorsOnly ? 'All actions' : 'Errors only'} onPress={view.toggleErrors} />
          )}
        </Box>
      )}
    </Box>
  )
}
