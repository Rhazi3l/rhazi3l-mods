// The step bars: which cells are lit, and how a bar is drawn on each surface. Pure, so it is tested alone.

import type { ChecklistTask } from '../types'

export const METER = 10
/** How many steps the checklist shows at once; the rest are summed up in one line. */
const MAX_VISIBLE_STEPS = 3
/** Room for a step's label after its bar: two cells of gap, then `Done` or a percentage. */
export const LABEL_CELLS = 6

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
export function meterRuns(cells: boolean[]): { lit: boolean; text: string }[] {
  const runs: { lit: boolean; text: string }[] = []
  for (const lit of cells) {
    const last = runs[runs.length - 1]
    if (last && last.lit === lit) last.text += '━'
    else runs.push({ lit, text: '━' })
  }
  return runs
}

/** Drawn bars: each cell is this many pixels wide, and the bar this thick, centred in a box this tall. */
export const BAR_CELL_PX = 8
const BAR_THICK_PX = 3
export const BAR_BOX_PX = 16
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
