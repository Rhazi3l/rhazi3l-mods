# rhazi3l-mods

Personal Claude Code mods. Each one is its own plugin, so install only the ones you want. They work in the terminal and in the desktop app.

| Mod | What it does | Controls |
|---|---|---|
| **toolbox** | A `✦ Info ▾` button at the right of the line under the prompt (just `✦ Info` in the desktop app, which has little room there). Click it, or type `/toolbox`, to open a small panel in the bottom-right corner (press `x` there, or the button again, to close it) with **Model** (Haiku, Sonnet, Opus, Fable, cheapest per token first, or More… for the full `/model` picker), **Effort** (Low to Max), **Advisor** (Haiku, Sonnet, Opus, Fable or Off, which runs `/advisor`; the highlighted button is the advisor that is set up) and **Mods**: an on/off button for each of the mods below that you have installed (Clean View, Better) (green ● on, grey ○ off). | The footer button, `/toolbox`, `/mods`, `/mods <name> on\|off` |
| **prompt-upgrade** | A `✦ Better` button in the line under the prompt, to the left of the Info button. Type a rough prompt, press the button, and a fast model rewrites it into one clearer request. A pane shows your prompt and the upgrade side by side, with what was added. Where the upgrade has `[placeholders]`, each gets its own field under FILL IN THE BLANKS: type what goes there and the upgrade updates live. Nothing is sent until you press **Run it** (or **Edit in prompt box**, which puts the text in the main prompt box to edit freely, **Copy** it, or **Cancel**); Run it also clears the draft it came from. It adds a goal, audience, format and what done looks like only where your prompt leaves them open, never invents facts (it leaves `[placeholders]`), and writes in British English without em dashes. One model call per upgrade, and no history is kept. The Info panel's Mods button shows or hides the footer button. | The footer button, `/better <prompt>`, the Toolbox's Mods button |
| **clean-view** | A plain-English checklist of Claude's plan and progress above the prompt, framed in the palette's colours (orange `✱` while working, blue `?` when it needs you, yellow `⚠` when stuck or `■` when stopped, green `✓` when done) with an overall Step x of y bar, and nothing technical in the transcript. Guided adds the latest action under the step in progress; Simple shows the checklist alone. When Claude asks you something, the frame turns blue and shows the question, with one-press reply buttons where it fits (Yes and No for a yes or no question, or its numbered options as Option 1, 2, 3 when the question asks you to choose one); pressing one sends it as your next message. `/view colours` opens a legend of the colours the checklist uses and when each shows (orange working, blue waiting for you, yellow stuck or stopped, green done). **Details** opens a pane with every step and every action in full (whole commands, file paths, addresses, what went wrong, helper agents' work), and its **Show tool output** button brings Claude Code's own tool rows back until the next job. | `Details` (or `d`) and `View:` buttons on the checklist, `/view simple\|guided\|details\|colours\|on\|off`, the Info panel's Mods button |

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

The Info panel shows no usage figures, so they don't sit in two places. Claude Code's own status line is the place for them, and for the prompt cache: the `statusLine` setting in `~/.claude/settings.json` runs a script of yours and draws its first line under the prompt. It is a Claude Code setting, not a mod, so it isn't in this repository. For example, with a script that prints the model, effort, context and rate limits (the five-hour and seven-day percentages are the nearest measure of what your plan counts):

My script is in `statusline/statusline.sh`: plan, model, effort, context bar, prompt cache, and the 5h and weekly figures with their reset times, in the mods' colours. It needs `jq`, and runs on Linux and macOS (it avoids bash 4 and GNU `date`). On a new computer, copy it and add the setting (`refreshInterval` re-runs it every 60 seconds so a quiet chat turns cold on screen):

```
cp statusline/statusline.sh ~/.claude/statusline.sh && chmod +x ~/.claude/statusline.sh
```

```json
"statusLine": { "type": "command", "command": "~/.claude/statusline.sh", "padding": 0, "refreshInterval": 60 }
```

The copy in this repository is the one to edit; copy it over `~/.claude/statusline.sh` afterwards. `/statusline` in a terminal session can write a script for you. The palette (see Colours below) keeps it looking the same as the mods.

## Cache and advisor notes

- The status line script adds `cache ● warm 42m` (time left) or `cache ○ cold · resume 174k tokens · new chat 47k`. It reads the chat's transcript, so it needs no mod. Warm means the main thread's last response is under an hour old (Claude Code asks for the one-hour cache on a subscription; pay-as-you-go keys get five minutes, so cold comes sooner there). Helper agents are ignored. Resume is the tokens that chat would write back into the cache; new chat is the first response's prompt (system prompt, tools, memory). The line only re-runs on activity, so `"refreshInterval": 60` sits beside `statusLine` in `~/.claude/settings.json` to let a quiet chat turn cold on screen.
- There is no percentage of the 5h or weekly limit, because Anthropic publishes no conversion from tokens to those percentages (and does not say whether cache tokens count at full weight). Compare the status line's 5h figure before and after a resume if you want a real number.
- The advisor is consulted by the main model, which stays on its own default (for example Sonnet), so its cache stays warm. Switching the main model with `/model` forfeits the cache. A change made with the Advisor buttons applies after `/clear` or `/compact`.

## Colours

All the mods draw with one palette (`hooks/palette.ts` in each mod): the theme's own orange for working and accents, and clear, softened colours for the rest, picked so every pair is easy to tell apart (blue for waiting on you, yellow for stuck or stopped, green for done and on, grey for off switches and the original prompt beside an upgrade, red for errors). They are fixed colours, so they do not follow the theme; unlit bars and dim text still do. A plugin cannot import another's files, so each mod keeps its own copy of `palette.ts`: change one, change all three. The status line script uses the same values.

## Adding a mod

1. Make a folder under `mods/` with `.claude-plugin/plugin.json`, `hooks/hooks.json` and `hooks/register.tsx` (copy `mods/clean-view` as a start, and its `hooks/palette.ts` so it matches).
2. Add it to `plugins` in `.claude-plugin/marketplace.json`.
3. To give it a toolbox button, keep its on/off in a `$.state` value `isOn` and answer `on` and `off` on its own slash command, then add it to the mod list (and its `isOn` to the contract) in `mods/toolbox`.
4. Check it with `claude plugin validate mods/<name>` and `claude plugin test mods/<name>`.
