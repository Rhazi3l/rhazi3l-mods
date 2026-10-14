// The colours every rhazi3l mod draws with, so their frames, bars and labels
// match. Each mod keeps its own copy (a plugin cannot import another's files):
// when you change one, change the same file in the other mods.
//
// Orange is the theme's own accent. The rest are softer than the theme's colours
// but more saturated than a pastel, picked so every pair is easy to tell apart
// (at least 30 apart in CIELAB colour distance). They are fixed hex values, so
// they do not follow the theme. Unlit bars and dim text still use the theme.

export const PASTEL = {
  /** In progress, and the accent: titles, lit bars, the star. The theme's orange. */
  working: '#d4743c',
  /** Waiting for the person's reply. A clear blue. */
  waiting: '#73a5de',
  /** Stuck, or a warning. A warm yellow. */
  stuck: '#f1ce7e',
  /** Done, and on in a switch. A fresh green. */
  done: '#9dcb86',
  /** Stopped, off, and the original beside an upgrade. A neutral grey. */
  stopped: '#787d87',
  /** Something went wrong. A coral red. */
  error: '#e67a85',
} as const
