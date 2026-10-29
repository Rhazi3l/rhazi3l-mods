// The checklist above the prompt: the frame, the header, the steps with their bars and the note.

import type { EngineInterface, RenderChildren, RenderElement } from 'claude-code'

import type { Checklist } from '../types'
import { BAR_BOX_PX, BAR_CELL_PX, LABEL_CELLS, METER, barSvg, meterCells, meterRuns, stepWindow } from './bars'
import { currentStep, firstSentence, runningFor, stuckText, waitingText } from './checklist'
import { PASTEL } from './palette'
import type { RenderEvent } from './render'
import { DEFAULT_TITLE } from './state'
import { MAX_NAME, formatDuration, trimToWidth } from './text'
import { openDetails } from './panes'

/** Draws the checklist for a job that has started (`startedAt`; `tick` moves the bars), above whatever the engine draws there (`below`). */
export async function drawBox(
  $: EngineInterface,
  e: RenderEvent<'AbovePrompt'>,
  c: Checklist,
  { startedAt, tick, helpers, below }: { startedAt: number; tick: number; helpers: number; below: RenderElement },
) {
  const ui = $.ui.resolve(e)
  const { Box, Text, Button } = ui
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

  // A stuck job points at what went wrong: the last action that failed.
  const failedAction = c.phase === 'stuck' ? c.actions.findLast(a => a.isFailed && !a.isHelper) : undefined
  const buttons = (
    <Box key="clean-view-buttons" flexDirection="row" flexShrink={0}>
      {failedAction && <Button key="clean-view-error" label="Show error" onPress={() => openDetails($, failedAction.id)} />}
      <Button
        key="clean-view-details"
        label="Details"
        hotkey="d"
        onPress={() => openDetails($)}
      />
    </Box>
  )
  const elapsed = formatDuration((c.finishedAt ?? now) - startedAt)
  // A slow action carries its own clock, so a long command does not look frozen.
  const clock = (ms: number | null) => (ms === null ? '' : ` · ${formatDuration(ms)}`)
  // With no to-do list the header is the only line, so it carries the latest action the way a step's row does.
  const doing = c.tasks.length === 0 ? c.actions.findLast(a => !a.isHelper) : undefined
  // The latest thing Claude said between tool calls, which the transcript no longer shows. It sits beside
  // the title while steps are running, and on a line of its own where the header has no room for it.
  // A note from a step that has since finished is old news, so it goes when the plan moves on.
  const lastNote = c.notes.at(-1)
  const isCurrent = lastNote !== undefined && (c.tasks.length === 0 || lastNote.step === currentStep(c))
  const note = (c.phase === 'working' || c.phase === 'stuck') && isCurrent ? lastNote : undefined
  const noteBesideTitle = note !== undefined && c.phase === 'working' && c.tasks.length > 0
  let header = doing ? (
    <Box flexDirection="row" flexShrink={1}>
      <Text bold color={PASTEL.working}>{'✱ Working…'}</Text>
      <Box flexDirection="row" flexShrink={1} marginLeft={1}>
        <Text dimColor wrap="truncate-end">{`· ${doing.icon} ${doing.detail || doing.label}${clock(runningFor(doing, now))}`}</Text>
        {doing.isFailed && (
          <Box flexShrink={0}>
            <Text color={PASTEL.error}>{" · didn't work"}</Text>
          </Box>
        )}
      </Box>
    </Box>
  ) : (
    <Box flexDirection="row" flexShrink={1}>
      <Box flexDirection="row" flexShrink={0}>
        <Text bold color={PASTEL.working}>{c.tasks.length === 0 ? '✱ Working…' : `✱ ${DEFAULT_TITLE}`}</Text>
        {c.tasks.length > 1 && <Text dimColor>{` · ${c.tasks.filter(t => t.status === 'done').length} of ${c.tasks.length}`}</Text>}
      </Box>
      {noteBesideTitle && (
        <Box flexShrink={1} marginLeft={1}>
          <Text dimColor wrap="truncate-end">{`· 💬 ${firstSentence(note.text)}`}</Text>
        </Box>
      )}
    </Box>
  )
  if (c.phase === 'needsYou') {
    header = (
      <Text color={PASTEL.waiting} wrap="truncate-end">
        {`‖ ${waitingText(c)}`}
      </Text>
    )
  } else if (c.phase === 'stuck') {
    header = (
      <Text color={PASTEL.stuck} wrap="truncate-end">
        {`⚠ ${stuckText(c)}`}
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

  // The desktop's Details button is taller than a line, so the first row under it needs room, unless the header
  // stands alone (the folded done box) or the question row beneath it already makes its own.
  const isHeaderAlone = c.phase === 'done' && c.isCollapsed
  const hasRoomBelowHeader = !isTerminal && c.tasks.length > 0 && !isHeaderAlone && !(c.phase === 'needsYou' && c.replies.length > 0)
  const headerRow = (
    <Box
      key="clean-view-header"
      flexDirection="row"
      justifyContent="space-between"
      flexWrap={isTerminal ? 'nowrap' : 'wrap'}
      paddingBottom={hasRoomBelowHeader ? 'md' : undefined}
    >
      <Box flexGrow={1} flexShrink={1} paddingRight={1}>
        {header}
      </Box>
      <Box flexDirection="row" flexShrink={0}>
        {helpers > 0 && <Text dimColor>{`🤖 ${helpers} helper${helpers === 1 ? '' : 's'}  `}</Text>}
        <Text dimColor>{`${c.phase === 'done' ? `took ${elapsed}` : elapsed}  `}</Text>
        {buttons}
      </Box>
    </Box>
  )
  const waitsForReply = c.phase === 'needsYou' && c.question !== ''
  // What Claude is asking, and one-press answers where the question has clear options.
  // The question and its buttons share a row, the buttons at the right where the steps' bars sit, so the
  // question takes one row less; a long question wraps in the room beside them. The desktop's buttons are taller
  // than a line, so a row that has them gets room above, and below only while steps follow it (alone, the frame's
  // edge is enough). A question without buttons needs none.
  const hasRoomyButtons = !isTerminal && c.replies.length > 0
  const askRows = waitsForReply
    ? [
        <Box
          key="clean-view-ask"
          flexDirection="row"
          flexWrap="wrap"
          alignItems="center"
          gap={1}
          paddingTop={hasRoomyButtons ? 'md' : undefined}
          paddingBottom={hasRoomyButtons && c.tasks.length > 0 ? 'md' : undefined}
        >
          <Box key="clean-view-question" flexGrow={1} flexShrink={1}>
            <Text wrap="wrap">{c.question}</Text>
          </Box>
          {c.replies.length > 0 && (
            <Box key="clean-view-replies" flexDirection="row" flexWrap="wrap" flexShrink={0} gap={1}>
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
          )}
        </Box>,
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
  if (isHeaderAlone) {
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
  const latest = c.actions.findLast(a => !a.isHelper)
  const showsTrail = latest !== undefined && c.phase !== 'done'
  // The latest action sits on the step's own row, after its name. The terminal's name column then spans the room
  // to the bar (icon, bar and label take the rest), so every row's bar stays aligned.
  const terminalNameCells = showsTrail ? Math.max(nameWidth + 1, width - (2 + METER + LABEL_CELLS) - 1) : nameWidth + 1

  const rows = c.tasks.flatMap((task, i) => {
    if (i < windowStart || i >= windowEnd) return []
    const isActive = task.status === 'active'
    const icon = task.status === 'done' ? '✓' : isActive ? (c.phase === 'needsYou' ? '‖' : '▶') : '○'
    // The icon and the bar say whether a step is running or waiting; the label only gives the facts.
    const label = task.status === 'done' ? 'Done' : isActive && task.hasReported ? `${task.percent}%` : ''
    const hasTrail = isActive && showsTrail && latest !== undefined
    const trailText = latest ? `${latest.icon} ${latest.detail || latest.label}${clock(runningFor(latest, now))}` : ''
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
            </Box>
          )}
        </Box>
        <Box key="meter" flexDirection="row" flexShrink={0}>
          {Svg ? (
            <Svg
              key={`meter-${task.id}`}
              source={barSvg(meterCells(task, tick), task.status === 'done' ? PASTEL.done : PASTEL.working)}
              alt={label || task.status}
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

  const noteRow = note && !noteBesideTitle ? (
    <Box key="clean-view-note" paddingLeft={2}>
      <Text dimColor wrap="truncate-end">{`💬 ${firstSentence(note.text)}`}</Text>
    </Box>
  ) : null

  return (
    <Box flexDirection="column">
      {frame([headerRow, ...askRows, ...rows, moreRow, noteRow])}
      {below}
    </Box>
  )
}
