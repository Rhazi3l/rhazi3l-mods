// The two side panes: Details (every step, action and note of the job) and the colour legend.

import type { EngineInterface, RenderChildren } from 'claude-code'

import type { Checklist, ChecklistAction } from '../types'
import { detailGroups, isRunningPhase } from './checklist'
import { PASTEL } from './palette'
import type { RenderEvent } from './render'
import { DETAILS_PANE, DETAILS_TITLE } from './state'
import { formatDuration } from './text'

/**
 * Opens Details at its newest lines. The engine then keeps the bottom in view as the pane grows,
 * until the person scrolls; the next job asks again.
 */
export async function openDetails($: EngineInterface) {
  const opened = await $.ui.open({ id: DETAILS_PANE, title: DETAILS_TITLE })
  await followDetails($)
  return opened
}

export async function followDetails($: EngineInterface) {
  try {
    await $.ui.scroll({ in: DETAILS_PANE, to: 'end' })
  } catch {
    // No pane to move (not open, or a headless host): nothing to follow.
  }
}

/** The colour legend: each frame colour the checklist uses, and when it shows. */
export async function drawColours($: EngineInterface, e: RenderEvent<'Pane'>) {
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
}

/** The Details pane: every step of the job and every action under it, in full. */
export async function drawDetails($: EngineInterface, e: RenderEvent<'Pane'>, c: Checklist, showsAll: boolean, toggle: () => void) {
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
      <Box key={`action-${a.id}`} flexDirection="column" paddingLeft={2}>
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
  const foldsFinished = canFold && !showsAll
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
        <Box flexDirection="row" flexShrink={1}>
          <Text bold color={PASTEL.working} wrap="truncate-end">
            Your request
          </Text>
          <Text dimColor>{`  ${summary}`}</Text>
        </Box>
      </Box>
      {groups}
      {/* At the bottom, where the pane follows the newest lines, so it stays in view. */}
      {canFold && (
        <Box key="clean-view-fold-row" marginTop={1}>
          <Button key="clean-view-fold" label={showsAll ? 'Fold finished' : 'Show all'} onPress={toggle} />
        </Box>
      )}
    </Box>
  )
}
