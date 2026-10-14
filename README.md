# rhazi3l-mods

Personal Claude Code mods. Each one is its own plugin, so install only the ones you want. They work in the terminal and in the desktop app.

| Mod | What it does | Controls |
|---|---|---|
| **toolbox** | A `◆ Toolbox ▾` button at the right of the line under the prompt. Click it, or type `/toolbox`, to open a small panel in the bottom-right corner (press `x` there, or the button again, to close it) with **Model** (Opus, Sonnet, Haiku, Fable, or More… for the full `/model` picker), **Effort** (low to max) and **Mods**: an on/off button for each of the mods below that you have installed (Clean View, Upgrade prompt) (green ● on, grey ○ off). | The footer button, `/toolbox`, `/mods`, `/mods <name> on\|off` |
| **prompt-upgrade** | An `✦ Upgrade prompt` button in the line under the prompt, to the left of the Toolbox button. Type a rough prompt, press the button, and a fast model rewrites it into one clearer request. A pane shows your prompt and the upgrade side by side, with what was added. Nothing is sent until you press **Run it** (or **Edit** it first, **Copy** it, or **Cancel**); Run it also clears the draft it came from. It adds a goal, audience, format and what done looks like only where your prompt leaves them open, never invents facts (it leaves `[placeholders]`), and writes in British English without em dashes. One model call per upgrade, and no history is kept. The Toolbox's Mods button shows or hides the footer button. | The footer button, `/better <prompt>`, the Toolbox's Mods button |
| **clean-view** | A plain-English checklist of Claude's plan and progress above the prompt, framed in the accent colour (amber when it needs you, green when done) with an overall Step x of y bar, and nothing technical in the transcript. Guided adds the latest action under the step in progress; Simple shows the checklist alone. **Details** opens a pane with every step and every action in full (whole commands, file paths, addresses, what went wrong, helper agents' work), and its **Show tool output** button brings Claude Code's own tool rows back until the next job. | `Details` (or `d`) and `View:` buttons on the checklist, `/view simple\|guided\|details\|on\|off`, the toolbox's Mods button |

## Install

The repository is private, so a computer installs from it only once git can reach GitHub as you: run `gh auth login`, then `gh auth setup-git`, first.

At the prompt of a terminal session, one line per mod:

```
/plugin install toolbox --marketplace Rhazi3l/rhazi3l-mods
/plugin install clean-view --marketplace Rhazi3l/rhazi3l-mods
/plugin install prompt-upgrade --marketplace Rhazi3l/rhazi3l-mods
```

Answer `y` to add the marketplace, then pick the user scope. From a shell, the same with `claude plugin install …`.

In the desktop app: click + next to the prompt box, then Plugins, Add marketplace with `Rhazi3l/rhazi3l-mods`, then Add plugin for each mod.

## Updating

After changes are pushed here:

```
claude plugin marketplace update rhazi3l-mods
claude plugin update toolbox@rhazi3l-mods
claude plugin update clean-view@rhazi3l-mods
claude plugin update prompt-upgrade@rhazi3l-mods
```

then `/reload-plugins` in any open session.

## Pairs well with a status line

The toolbox shows no usage figures, so they don't sit in two places. Claude Code's own status line is the place for them: the `statusLine` setting in `~/.claude/settings.json` runs a script of yours and draws its first line under the prompt. It is a Claude Code setting, not a mod, so it isn't in this repository. For example, with a script that prints the model, effort, context and rate limits:

```json
"statusLine": { "type": "command", "command": "~/.claude/statusline.sh", "padding": 0 }
```

`/statusline` in a terminal session can write a script for you. Using the theme's colours keeps it looking the same as the mods.

## Adding a mod

1. Make a folder under `mods/` with `.claude-plugin/plugin.json`, `hooks/hooks.json` and `hooks/register.tsx` (copy `mods/clean-view` as a start).
2. Add it to `plugins` in `.claude-plugin/marketplace.json`.
3. To give it a toolbox button, keep its on/off in a `$.state` value `isOn` and answer `on` and `off` on its own slash command, then add it to the mod list (and its `isOn` to the contract) in `mods/toolbox`.
4. Check it with `claude plugin validate mods/<name>` and `claude plugin test mods/<name>`.
