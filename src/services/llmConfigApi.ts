import api from './api'
import type { LLMConfig } from '@/types'

export interface TestConnectionResult {
  success: boolean
  message: string
}

export interface SessionCheckTrial {
  code: string
  name: string
  plantPrompt: string
  plantResponse: string
  probePrompt: string
  probeResponse: string
  leakedCode: boolean
  leakedName: boolean
  leaked: boolean
  provider: string
  modelName: string
}

export const llmConfigApi = {
  /**
   * One canary trial with the SAVED Target LLM config: request 1 plants a unique
   * booking reference, request 2 (a separate call) asks for it back. Web
   * chatbots can take minutes for the two calls, hence the long timeout.
   */
  sessionCheck(evaluationId: string) {
    return api
      .post<SessionCheckTrial>(`/evaluations/${evaluationId}/llm-config/session-check/`, {}, { timeout: 300000 })
      .then(res => res.data)
  },
  fetchConfig(evaluationId: string) {
    return api.get<LLMConfig>(`/evaluations/${evaluationId}/llm-config`).then(res => res.data)
  },
  saveConfig(evaluationId: string, payload: LLMConfig) {
    return api
      .put<LLMConfig>(`/evaluations/${evaluationId}/llm-config`, payload)
      .then(res => res.data)
  },
  testConnection(evaluationId: string) {
    return api
      .post<TestConnectionResult>(`/evaluations/${evaluationId}/llm-config/test-connection`)
      .then(res => res.data)
  },
}

export interface ModelListResult {
  models: string[]
  error: string | null
}

export const llmModelsApi = {
  /** Never rejects for an unreachable endpoint: the backend reports it in `error`. */
  list(evaluationId: string, payload: { provider: string; baseUrl: string; apiKey?: string }, signal?: AbortSignal) {
    return api
      .post<ModelListResult>(`/evaluations/${evaluationId}/llm-config/models/`, payload, { signal })
      .then(res => res.data)
  },
}
