// The words of Prompt Upgrade: what the model is asked, and how its answer is read.

import type { ModelCompleteRequest } from 'claude-code'

const MAX_PROMPT = 8000

const SYSTEM = `You rewrite a person's rough prompt for an AI coding assistant into one clearer request.
Rules:
- Keep exactly what they meant. Do not add tasks, scope or requirements they did not ask for.
- Add only what the prompt leaves open and a good request needs: the goal, who it is for, the format, and what done looks like.
- A prompt that is already specific stays nearly as it is.
- Never invent facts, names, numbers, prices or file names. Where something is unknown, leave a [placeholder] in square brackets.
- If the text is not a request (a test word, a greeting, a single word), return it unchanged with an empty list.
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

/** Below this many words a prompt has nothing for the model to improve, so no call is made. */
const MIN_WORDS = 4
export const isTooShort = (text: string) => countWords(text) < MIN_WORDS

/** `1 word`, `2 words`. */
export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Whether the model found nothing to add: the same words, or no details listed and at most two words of difference. */
export function isUnchanged(original: string, upgraded: string, added: readonly string[]): boolean {
  const plain = (text: string) => text.toLowerCase().replace(/[\s.!?]+/g, ' ').trim()
  return plain(original) === plain(upgraded) || (added.length === 0 && Math.abs(countWords(upgraded) - countWords(original)) <= 2)
}

/** The `[placeholders]` in a text, without the brackets, each once, in the order they first appear. A `[link](address)` is not one. */
export function findPlaceholders(text: string): string[] {
  const found: string[] = []
  for (const match of text.matchAll(/\[([^[\]\n]{2,80})\](?!\()/g)) {
    const name = (match[1] ?? '').trim()
    if (name !== '' && !found.includes(name)) found.push(name)
  }
  return found
}

/** The text with each `[placeholder]` the person has filled in replaced by their words; the rest stay as they were. */
export function fillPlaceholders(text: string, fills: Readonly<Record<string, string>>): string {
  return text.replace(/\[([^[\]\n]{2,80})\](?!\()/g, (whole, inner: string) => {
    const typed = (fills[inner.trim()] ?? '').trim()
    return typed === '' ? whole : typed
  })
}
