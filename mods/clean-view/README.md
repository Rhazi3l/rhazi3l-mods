# clean-view

A plain-English checklist above the prompt in place of Claude Code's technical rows. It works in the terminal and in the desktop app.

## What you see

**The box.** It is there whenever Claude works, and its colour says how the job stands: orange `✱` working, blue `?` needs you, yellow `⚠` stuck or `■` stopped, green `✓` done.

- **Header.** `✱ Working on your request · 2 of 6`, then the latest thing Claude said between tool calls (its first sentence, after `💬`), then on the right a `🤖 1 helper` light while a helper agent runs, the time and a **Details** button. Before a to-do list exists the header is one line, `✱ Working…`, with the latest action.
- **Steps.** At most three rows: the step in progress first, then what comes next, with one dim line for the rest (`✓ 2 earlier steps done · 1 more to come`). Each row has an icon, the step name, a bar that sweeps while the step runs and fills when it is done, and `Done` or a percentage when one is known. The latest action sits on the step in progress, after its name, with its own clock once it has run for 5 seconds without an answer. On the desktop app the bars are drawn as images so they line up with their rows.
- **Stuck.** After three failed actions in a row, or a refused step, or an error, the frame turns yellow and a **Show error** button opens Details at the action that failed.
- **Asking you something.** When Claude's answer ends in a question, the frame turns blue and shows it, with one-press reply buttons where they fit: Yes and No for a yes or no question, or Option 1, 2, 3 when it asks you to choose. Pressing one sends it as your next message.
- **Done.** `✓ All done · 6 steps` and how long it took, then the box folds to that single line after five seconds.

## What it hides

- Tool rows (`Ran 2 shell commands`), their results and progress hints.
- Claude's own notes between tool calls. They show in the box and in Details instead. To tell a note from the closing answer, the plugin holds a step's text until the step ends, so an answer appears whole instead of typing out.
- A helper agent's hand-back and "Agent finished" lines. A helper that failed or was stopped keeps its row.
- The spinner's own to-do rows once a plan exists (terminal only).

## Where the steps come from

Claude Code's own to-do list: `TodoWrite`, `TaskCreate` and `TaskUpdate`, or the desktop app's `update_plan` tool (a full list, or `advance`, `done` and `start` updates). Clean View adds no tools of its own and holds none back. Where another plugin stops the system prompt being extended (a managed machine can), that section is not applied and Claude is not asked for plain step names or short notes; the box still follows the to-do calls it makes. A short section it adds to the system prompt asks for plain step names, answers that lead with the result, any finding or choice kept for the closing summary, and a question as the last paragraph when it needs your decision.

## Details

Press **Details** (or `d`). The pane opens at the newest lines and follows them until you scroll.

- Every step with its action count and how long it took, and under it every action in full: whole commands, paths and addresses, what each tool answered (cut at 4,000 characters), what went wrong, and helper agents' work.
- Claude's notes sit at the step they introduced, in grey italics after `💬`.
- White names what happened, one grey carries what backs it up, red is only for what went wrong.
- While the job runs, finished steps fold to their heading (a step with an error stays open). **Show all** at the bottom opens them, **Fold finished** closes them again, and a finished job lists everything.
- **Errors only** keeps just the failed actions and their steps; **All actions** brings the rest back. **Copy** puts every failed action and what it answered on the clipboard.
- Plain confirmations such as `File created successfully` are left out. Errors are not.

## Alerts

A job that ran 20 seconds or more and ends done, stuck or waiting for you sends a notification through the terminal's own channel (iTerm2, kitty, Ghostty or the bell), or a toast where there is none, as on the desktop app. `/view alerts off` silences them and `/view alerts on` brings them back. A short job sends nothing, since you are still looking.

## Commands

| Command | Does |
|---|---|
| `/view alerts on` / `off` | Switches the alerts |
| `/view on` / `off` | Switches Clean View; off leaves Claude Code as it is |

## How it is built

| File | Holds |
|---|---|
| `hooks/register.tsx` | The hooks, and the saved values (the engine reads and writes those from this file only) |
| `hooks/checklist.ts` | How a job changes: pure functions from one checklist to the next |
| `hooks/box.tsx` | The box above the prompt |
| `hooks/panes.tsx` | Details |
| `hooks/bars.ts` | The step bars and the three-row window |
| `hooks/text.ts` | Plain-English names, action summaries, questions and reply buttons |
| `hooks/state.ts`, `render.ts`, `info.ts`, `palette.ts` | Shared names and texts, a type, the command, the colours |
| `types/index.d.ts` | The contract for the saved values |

## Checking it

```
claude plugin validate mods/clean-view
claude plugin test mods/clean-view
scripts/check-palettes.sh
```

The last one confirms every mod's copy of `palette.ts` still matches.

## Not covered by the tests

The test harness accepts a scroll but does not move a window, so the follow-the-newest-lines behaviour, `Show error`'s jump, the `Copy` button's clipboard write and a native notification need checking by hand.
