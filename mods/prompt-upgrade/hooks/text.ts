// The words of Prompt Upgrade: what the model is asked, and how its answer is read.

import type { ModelCompleteRequest } from 'claude-code'

export const MAX_PROMPT = 8000

const SYSTEM = `You rewrite a person's rough prompt for an AI coding assistant into one clearer request.
Rules:
- Keep exactly what they meant. Do not add tasks, scope or requirements they did not ask for.
- Add only what the prompt leaves open and a good request needs: the goal, who it is for, the format, and what done looks like.
- A prompt that is already specific stays nearly as it is.
- Never invent facts, names, numbers, prices or file names. Where something is unknown, leave a [placeholder] in square brackets.
- Write one request in plain language, as the person could have typed it themselves.
- British English. No em dashes.
Answer with JSON only, no other text: {"prompt": "the rewritten prompt", "added": ["short phrase", ...]}
"added" lists up to five short phrases saying what you added. If nothing needed adding, return the prompt unchanged and an empty list.`

export function buildRequest(original: string): ModelCompleteRequest {
  return {
    model: 'haiku',
    effort: 'low',
    maxTokens: 1500,
    timeoutMs: 30000,
    system: SYSTEM,
    prompt: `The rough prompt:\n\n${original.slice(0, MAX_PROMPT)}`,
  }
}

export type Upgrade = { upgraded: string; added: string[] }

/** Reads the model's JSON answer, which may come in a code fence or with a line of text around it. */
export function parseUpgrade(reply: string): Upgrade | null {
  const start = reply.indexOf('{')
  const end = reply.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const data = JSON.parse(reply.slice(start, end + 1)) as { prompt?: unknown; added?: unknown }
    if (typeof data.prompt !== 'string' || data.prompt.trim() === '') return null
    const added = Array.isArray(data.added)
      ? data.added.filter((item): item is string => typeof item === 'string' && item.trim() !== '').slice(0, 5)
      : []
    return { upgraded: data.prompt.trim(), added }
  } catch {
    return null
  }
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}
