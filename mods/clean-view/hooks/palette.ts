// The colours every rhazi3l mod draws with, so their frames, bars and labels
// match. Each mod keeps its own copy (a plugin cannot import another's files):
// when you change one, change the same file in the other mods.
//
// Orange is the theme's own accent. The rest sit halfway between the theme's
// colour and a pastel of it: softer than the theme, but still easy to tell apart.
// They are fixed hex values, so they do not follow the theme. Unlit bars and dim
// text still use the theme.

export const PASTEL = {
  /** In progress, and the accent: titles, lit bars, the star. The theme's orange. */
  working: '#d4743c',
  /** Waiting for the person's reply. A medium-soft blue. */
  waiting: '#94afca',
  /** Stuck, or a warning. A medium-soft yellow. */
  stuck: '#edd29d',
  /** Done, and on in a switch. A medium-soft green. */
  done: '#b1c89e',
  /** Stopped, off, and the original beside an upgrade. A medium-soft grey. */
  stopped: '#8f949d',
  /** Something went wrong. A medium-soft red. */
  error: '#de868e',
} as const
