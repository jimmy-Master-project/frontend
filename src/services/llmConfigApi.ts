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
