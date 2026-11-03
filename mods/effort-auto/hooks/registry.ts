import type { EngineInterface } from 'claude-code'

/**
 * The mods' shared switchboard. A plugin cannot read another's values by a computed name, so each mod
 * with an on/off writes a small file here and the toolbox lists the folder: a mod appears in the
 * toolbox when it is installed and has written its file, with nothing added to the toolbox.
 * Each mod keeps its own copy of this file (a plugin cannot import another's).
 */
export type ModEntry = { id: string; name: string; command: string; description: string }

/** Records the mod and its on/off for the toolbox. Never throws: a headless host just has no switchboard. */
export async function publishMod($: EngineInterface, entry: ModEntry, isOn: boolean, extra: Record<string, unknown> = {}) {
  try {
    const home = $.plugin.root.split('/.claude/')[0] ?? ''
    await $.fs.write(`${home}/.claude/mods-registry/${entry.id}.json`, JSON.stringify({ ...entry, ...extra, isOn }))
  } catch {
    // Nowhere to write: the toolbox simply doesn't list this mod.
  }
}
