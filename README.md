# rhazi3l-mods

Personal Claude Code mods in one pack, managed from the **toolbox**: the `◆ toolbox ▾` button at the right of the line under the prompt. Click it, or type `/toolbox`, to open a small panel in the bottom-right corner (press `x` there, or the button again, to close it) with:

- **Model**: Opus, Sonnet, Haiku, Fable, or More… for the full `/model` picker
- **Effort**: low to max (runs `/effort`)
- **Mods**: one on/off button per mod (green ● on, grey ○ off)

Usage figures live in the status line below (see Status line), not in the toolbox.

`/mods` lists the mods, and `/mods <name> on|off` switches one from the keyboard.

## Mods

| Mod | What it does | Controls |
|---|---|---|
| Clean View | A plain-English checklist of Claude's plan and progress above the prompt, framed in the accent colour (amber when it needs you, green when done) with an overall Step x of y bar, and nothing technical in the transcript. Guided adds the latest action under the step in progress; Simple shows the checklist alone. **Details** opens a pane with every step and every action in full (whole commands, file paths, addresses, what went wrong, helper agents' work), and its **Show tool output** button brings Claude Code's own tool rows back until the next job. | Toolbox Mods button, `Details` (or `d`) and `View:` buttons on the checklist, `/view simple\|guided\|details\|on\|off` |

## Status line

`statusline/statusline.sh` draws one row under the prompt: plan, model, effort, a context bar, and the 5-hour and weekly limits with time to reset (cost too on the API), in the active Claude Code theme's colours (amber from 80%, red from 95%). It needs `jq`. Turn it on in `~/.claude/settings.json`, with the path to this folder:

```json
"statusLine": { "type": "command", "command": "~/Work/rhazi3l-mods/statusline/statusline.sh", "padding": 0 }
```

## Install

At the prompt of a terminal session:

```
/plugin install rhazi3l-mods --marketplace Rhazi3l/rhazi3l-mods
```

Answer `y` to add the marketplace, then pick the user scope.

From a shell:

```
claude plugin install rhazi3l-mods --marketplace Rhazi3l/rhazi3l-mods
```

In the desktop app: click + next to the prompt box, then Plugins, Add marketplace with `Rhazi3l/rhazi3l-mods`, then Add plugin.

The repository is private, so a computer installs it only once git can reach GitHub as you: run `gh auth login`, then `gh auth setup-git`, before installing.

## Updating

After changes are pushed here:

```
claude plugin update rhazi3l-mods
```

then `/reload-plugins` in any open session.

## Adding a mod

1. Make a folder under `hooks/` with the mod's code and an `info.ts` describing it (`ModInfo` in `hooks/pack.ts`: id, name, tools, commands).
2. Add the info to `MODS` in `hooks/catalog.ts`. The toolbox gets its button from there.
3. Call the mod's register function from `hooks/register.tsx`.
4. Inside the mod, check `isModOn(enabledMods, '<id>')` before doing anything.
5. Check it with `claude plugin validate .` and `claude plugin test .`.
