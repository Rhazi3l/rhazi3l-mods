---
name: dashboard-pipeline
description: "Runs the full dashboard polish pipeline in one go: dashboard-polish rules as the locked brief, then ui-ux-pro-max (design system), frontend-design (design plan and build), impeccable (critique, fixes, polish) and web-design-guidelines (review and fix high and medium issues), then the dashboard-polish checks and report. Use when the user asks to run the pipeline, fully polish or overhaul a dashboard, or polish a dashboard with all the design skills."
---

# Dashboard pipeline

One run, six stages, in this order. Finish each stage across the whole dashboard before starting the next. Load each skill with the Skill tool when its stage starts; do not ask the user to run them.

## Who wins a conflict

The dashboard-polish skill is the brief. Its fixed rules are locked for every later stage:

- Palette: the fixed page, card, border and burnt-orange accent values, orange never as a data colour, the green and rose status meanings.
- Type: one family, four sizes (12, 14, 16, 28), weight 400, tabular numerals, sentence case, no uppercase or letter-spacing.
- Spacing tokens, 12-column card grid, equal-height paired cards, doughnut size.
- Chart rules, HTML keys, side-drawer drill-downs, tick-box filters.
- Dark and light modes, dark by default. British English, metric, 24-hour time, DD/MM/YYYY, GBP.

Precedence when skills disagree:

1. Accessibility and contrast (4.5 to 1 text, 3 to 1 marks) beat everything, including a locked rule. If a locked rule fails contrast, keep the rule's intent, fix the value, and name it in the report.
2. Locked dashboard-polish rules beat any other skill's styling advice. Drop a suggestion that would change them (a new font, extra weights, a gradient, a new accent, uppercase labels, extra sizes) and list it in the report as "declined, conflicts with dashboard-polish".
3. Other skills decide everything the locked rules leave open: data hues, chart choice, UX flow, hierarchy within the four sizes, states, empty and error handling, keyboard and focus behaviour, copy clarity.

Readability rule for every stage: figures and the 12px caption text must stay highly readable. Captions use secondary text colour at minimum (never muted) when they carry a figure or a label a reader needs, and no figure goes below 14px.

## Stage 0. Load the brief

Load `dashboard-polish:dashboard-polish`. Read its SKILL.md and the references it names for the passes. For an existing dashboard, render it and run its audit (step 2) and five lines (step 3). Show the audit and five lines and wait for the user's answer, unless they said to just do it. That wait is the only stop in the pipeline.

## Stage 1. Design system (ui-ux-pro-max)

Load `ui-ux-pro-max:ui-ux-pro-max` and generate a complete design system for this dashboard, with the product and character from the five lines as the query. Then merge it into the brief:

- Keep from it: data-colour hues (checked against the fixed surfaces in both modes), chart type advice, UX guidelines, interaction and state patterns, component specs that fit the locked tokens.
- Replace with locked values: background, surface, border, accent, font family, sizes, weights, spacing.

Write the merged result as CSS variables per mode (the only place hex values appear) and as a short `DESIGN.md` beside the dashboard, so the later stages read one source.

## Stage 2. Design plan and build (frontend-design)

Load `frontend-design:frontend-design`. Write a design plan that works within the merged design system: layout per section, chart form per card, hierarchy, the one signature detail and the colour moments from the five lines. Check the plan line by line against the brief (locked rules plus the user's request) and fix any line that breaks it before building.

Apply it: build or restyle the dashboard using dashboard-polish passes 1 to 9 in order, with the plan deciding the open choices. Keep the product: features, numbers and section order stay.

## Stage 3. Critique, fix, polish (impeccable)

Load `impeccable:impeccable` with `critique` and the dashboard as target. Treat this as refinement, not redesign: keep the established world. Fix every finding that does not conflict with a locked rule. Render again.

Then load `impeccable:impeccable` with `polish` and the same target, and apply its fixes under the same limits. Motion stays at 150 to 200ms fades and state changes, none under reduced motion.

## Stage 4. Guidelines review (web-design-guidelines)

Load `web-design-guidelines` with the dashboard files. It reports findings as `file:line` without severity, so classify each one:

- High: breaks access or function (missing labels, no keyboard path, focus lost, contrast fail, broken on narrow widths, data loss risk).
- Medium: degrades use (missing states, poor targets, unclear copy, layout shift, slow or janky interaction).
- Low: preference or minor consistency.

Fix all high and medium findings that do not conflict with a locked rule. List low findings in the report without fixing them.

## Stage 5. Check and report

Run the dashboard-polish sweep (references/cohesion.md) and every check under its "Reporting back", because stages 3 and 4 can drift from the brief. Fix what drifted. Then report in one message:

- Per stage: what changed, in a few lines.
- Declined suggestions and the locked rule each conflicted with.
- Low guidelines findings left open.
- Contrast check result, both modes.
- Knock-on effects with fixes, and what the changes cost.
- Whether you saw the live render; if not, ask for screenshots in dark, light and phone width.

## Missing skills

Before Stage 0, check that all five skills are available: `dashboard-polish:dashboard-polish`, `ui-ux-pro-max:ui-ux-pro-max`, `frontend-design:frontend-design`, `impeccable:impeccable`, `web-design-guidelines`. If any is missing, list it with its install line below and ask whether to stop or continue without that stage. Never continue without dashboard-polish: it is the brief.

```
/plugin install dashboard-polish@rhazi3l-mods
/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill
/plugin install ui-ux-pro-max@ui-ux-pro-max-skill
/plugin install frontend-design@anthropic-plugin-directory
/plugin marketplace add pbakaus/impeccable
/plugin install impeccable@impeccable
npx skills add vercel-labs/agent-skills --skill web-design-guidelines -g
```
