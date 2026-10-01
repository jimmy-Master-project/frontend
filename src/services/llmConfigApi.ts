import api from './api'
import type { LLMConfig } from '@/types'

export interface TestConnectionResult {
  success: boolean
  message: string
}

export const llmConfigApi = {
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
