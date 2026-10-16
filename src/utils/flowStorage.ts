/**
 * Namespaced, failure-tolerant localStorage access for the flow editor.
 *
 * Storage can be disabled (private mode, quota, sandboxed iframes) or contain
 * corrupted JSON; every helper swallows those errors and falls back to
 * `null` / no-op so the editor always renders with its defaults.
 */
const PREFIX = 'llm-bias-pipeline:flow:v1'

export const flowStorageKeys = {
  layout: (evaluationId: string) => `${PREFIX}:layout:${evaluationId}`,
  bots: (evaluationId: string) => `${PREFIX}:bots:${evaluationId}`,
  botRuns: (evaluationId: string) => `${PREFIX}:bot-runs:${evaluationId}`,
  /** Reusable Target LLM configs shared by every evaluation (no API keys). */
  botPresets: () => `${PREFIX}:bot-presets`,
}

/** Keys written by the standalone frontend-node-v app (read-only fallback). */
export const legacyFlowStorageKeys = {
  layout: (evaluationId: string) => `matraix-flow:${evaluationId}`,
  bots: (evaluationId: string) => `matraix-bots:${evaluationId}`,
}

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

/** Parsed JSON for the first key that holds a value, or `null`. */
export function readFlowJson(...keys: string[]): unknown {
  const store = storage()
  if (!store) return null
  for (const key of keys) {
    try {
      const raw = store.getItem(key)
      if (raw !== null) return JSON.parse(raw) as unknown
    } catch {
      // Corrupted value or blocked storage: try the next key / give up.
    }
  }
  return null
}

export function writeFlowJson(key: string, value: unknown): void {
  try {
    storage()?.setItem(key, JSON.stringify(value))
  } catch {
    // Quota exceeded or storage disabled: layout simply isn't persisted.
  }
}

export function removeFlowKeys(...keys: string[]): void {
  const store = storage()
  if (!store) return
  for (const key of keys) {
    try {
      store.removeItem(key)
    } catch {
      // ignore
    }
  }
}
