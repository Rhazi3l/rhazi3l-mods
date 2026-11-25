# Chart.js settings

Use these when the dashboard is built with Chart.js. Set them once, so every chart carries the same look. With another chart library, apply the same settings (no tick stubs, rounded segments, card-coloured gaps, quiet tooltip, built-in legend off) through its own options. `cssVar(name)` reads a CSS variable, and the variable names here are examples.

```js
Chart.defaults.color = cssVar('--mute');
Chart.defaults.borderColor = cssVar('--line');
Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
Chart.defaults.font.size = 12;
Chart.defaults.scale.grid.drawTicks = false;   // no tick stubs between axis and labels
Chart.defaults.scale.ticks.padding = 8;
Object.assign(Chart.defaults.plugins.tooltip, {
  backgroundColor: cssVar('--bg'), titleColor: cssVar('--ink'), bodyColor: cssVar('--ink2'),
  borderColor: cssVar('--line'), borderWidth: 1, padding: 8, cornerRadius: 6, boxPadding: 4 });
const base = { responsive: true, maintainAspectRatio: false,
  animation: reducedMotion ? false : { duration: 200 }, plugins: { legend: { display: false } } };

// An object radius rounds every segment of a stack; a number rounds only its ends.
const RAD = { topLeft: 4, topRight: 4, bottomLeft: 4, bottomRight: 4 };
const bar = (label, data, color, extra) => ({ label, data, backgroundColor: color,
  borderRadius: RAD, borderSkipped: false, borderWidth: 1, borderColor: cssVar('--card'),
  maxBarThickness: 24, ...extra });

// Doughnut: rounded segments split by a card-coloured gap, total in the centre.
{ data: values, backgroundColor: colours, borderWidth: 2, borderColor: cssVar('--card'), borderRadius: 6 }
options: { ...base, cutout: '62%' }   // centre: total at title size (26px) primary, unit at caption size (12px) muted
```

- Round every bar segment, stacked or not, with the object radius above, and separate stacked segments with a 1px card-coloured border.
- Cap bar thickness with `maxBarThickness` (24 here).
- Draw canvas colours from CSS variables at draw time, and destroy and recreate charts when the theme changes.
