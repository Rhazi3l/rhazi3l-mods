# rhazi3l-mods

Personal Claude Code mods in one pack. A **Mods** row above the prompt has one button per mod: click it to switch that mod on or off. `/mods` lists them, and `/mods <name> on|off` does the same from the keyboard.

## Mods

| Mod | What it does | Controls |
|---|---|---|
| Clean View | A plain-English checklist of Claude's plan and progress above the prompt. In Guided view each technical step is one short line (skills, websites, app connections, commands, files); Simple view hides them. | Mods row button, `View:` button on the checklist, `/view simple\|guided\|on\|off` |

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
2. Add the info to `MODS` in `hooks/catalog.ts`. The Mods row gets its button from there.
3. Call the mod's register function from `hooks/register.tsx`.
4. Inside the mod, check `isModOn(enabledMods, '<id>')` before doing anything.
5. Check it with `claude plugin validate .` and `claude plugin test .`.
