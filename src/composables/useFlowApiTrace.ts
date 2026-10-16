import { onBeforeUnmount, ref } from 'vue'

import type { FlowNodeKind } from '@/components/flow/WorkflowNode.vue'
import { onApiTrace, type ApiTraceEntry } from '@/services/api'

/** Latest call of one endpoint, as recorded for a flow node. */
export interface FlowApiCall extends ApiTraceEntry {
  /** Method + path with numeric ids replaced by `{id}`. */
  endpoint: string
  /** How many times this endpoint was called since the trace was cleared. */
  count: number
}

/** The backend endpoints each node kind talks to (static contract). */
export const NODE_ENDPOINTS: Record<FlowNodeKind, string[]> = {
  trigger: [],
  evaluation: ['GET /evaluations/{id}'],
  prompts: [
    'POST /evaluations/{id}/prompt-population/generate',
    'GET /prompt-populations/{id}/',
    'GET /evaluations/{id}/prompt-population',
    'GET /evaluations/{id}/prompts',
  ],
  llm: [
    'GET /evaluations/{id}/llm-config',
    'PUT /evaluations/{id}/llm-config',
    'POST /evaluations/{id}/llm-config/test-connection',
    'POST /evaluations/{id}/llm-config/models/',
  ],
  run: [
    'POST /evaluations/{id}/runs/',
    'GET /runs/{id}/status/',
    'GET /evaluations/{id}/runs/latest/',
    'GET /evaluations/{id}/runs/ (run history)',
  ],
  responses: ['GET /evaluations/{id}/responses', 'DELETE /runs/{id}/responses/{id}/'],
}

const MAX_ENDPOINTS_PER_NODE = 10
const SECRET_KEYS = new Set(['apiKey', 'api_key'])

function endpointOf(method: string, url: string) {
  const path = url.split('?')[0].replace(/\/\d+(?=\/|$)/g, '/{id}')
  return `${method} ${path}`
}

function kindOf(url: string): FlowNodeKind | null {
  if (/\/llm-config/.test(url)) return 'llm'
  if (/\/prompt-population|\/prompts|\/persona\//.test(url)) return 'prompts'
  if (/\/responses|\/fairness-metrics/.test(url)) return 'responses'
  if (/\/runs\b/.test(url)) return 'run'
  if (/^\/?evaluations\/[^/]+\/?$/.test(url)) return 'evaluation'
  return null
}

function maskSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(maskSecrets)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      SECRET_KEYS.has(key) ? (item ? '••••' : item) : maskSecrets(item),
    ]),
  )
}

/**
 * Records the real API traffic of the flow editor, grouped per node.
 *
 * Calls are attributed by URL to a node kind. `/llm-config` calls go to the
 * bot node set with `setLlmNode` (the flow runs bots strictly one at a time),
 * and fall back to the `llm` kind otherwise. Requests that belong to another
 * evaluation are ignored.
 */
export function useFlowApiTrace(evaluationId: () => string | undefined) {
  const calls = ref<Record<string, FlowApiCall[]>>({})
  let llmNodeId: string | null = null

  function keyFor(kind: FlowNodeKind) {
    return kind === 'llm' && llmNodeId ? `llm:${llmNodeId}` : kind
  }

  function record(entry: ApiTraceEntry) {
    const current = evaluationId()
    const owner = entry.url.match(/evaluations\/([^/?]+)/)?.[1]
    if (!current || (owner && owner !== current)) return
    const kind = kindOf(entry.url)
    if (!kind) return
    const key = keyFor(kind)
    const endpoint = endpointOf(entry.method, entry.url)
    const list = calls.value[key] ?? []
    const previous = list.find(item => item.endpoint === endpoint)
    const next: FlowApiCall = {
      ...entry,
      requestBody: maskSecrets(entry.requestBody),
      responseBody: maskSecrets(entry.responseBody),
      endpoint,
      count: (previous?.count ?? 0) + 1,
    }
    calls.value[key] = [next, ...list.filter(item => item.endpoint !== endpoint)].slice(0, MAX_ENDPOINTS_PER_NODE)
  }

  const stop = onApiTrace(record)
  onBeforeUnmount(stop)

  return {
    calls,
    /** Calls recorded for a node (bot nodes also see unattributed llm calls). */
    callsFor(nodeId: string, kind: FlowNodeKind): FlowApiCall[] {
      if (kind !== 'llm') return calls.value[kind] ?? []
      return [...(calls.value[`llm:${nodeId}`] ?? []), ...(calls.value.llm ?? [])]
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    },
    setLlmNode(nodeId: string | null) {
      llmNodeId = nodeId
    },
    clear() {
      calls.value = {}
    },
  }
}

/** Shrinks big payloads for display: long arrays and strings are cut. */
export function compactForDisplay(value: unknown, maxItems = 5, maxString = 1500): unknown {
  if (typeof value === 'string') {
    return value.length > maxString ? `${value.slice(0, maxString)}… (+${value.length - maxString} chars)` : value
  }
  if (Array.isArray(value)) {
    const head = value.slice(0, maxItems).map(item => compactForDisplay(item, maxItems, maxString))
    return value.length > maxItems ? [...head, `… ${value.length - maxItems} more item(s)`] : head
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, compactForDisplay(item, maxItems, maxString)]),
    )
  }
  return value
}
