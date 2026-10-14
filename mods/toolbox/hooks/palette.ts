// The pastel colours every rhazi3l mod draws with, so their frames, bars and
// labels match. Each mod keeps its own copy (a plugin cannot import another's
// files): when you change one, change the same file in the other mods.
//
// They are fixed hex values, softer than the theme's colours, so they do not
// follow the theme. Unlit bars and dim text still use the theme.

export const PASTEL = {
  /** In progress, and the accent: titles, lit bars, the star. A soft orange. */
  working: '#de9e79',
  /** Waiting for the person's reply. A soft blue. */
  waiting: '#a8bdd2',
  /** Stuck, or a warning. A soft yellow. */
  stuck: '#efdaaf',
  /** Done, and on in a switch. A soft green. */
  done: '#bfd1af',
  /** Stopped, off, and the original beside an upgrade. A soft grey. */
  stopped: '#a9aeb7',
  /** Something went wrong. A soft red. */
  error: '#e39da3',
} as const
