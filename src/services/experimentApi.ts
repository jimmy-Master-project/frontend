import api from './api'
import type { PromptPopulationSummary } from '@/types'
import type { RawPopulationPrompt } from '@/utils/experimentMetrics'

/** Population history of an evaluation (experiment conditions) and their prompts. */
export const experimentApi = {
  /** Every prompt population of an evaluation, newest first. */
  listPopulations(evaluationId: string, signal?: AbortSignal) {
    return api
      .get<PromptPopulationSummary[]>(`/evaluations/${evaluationId}/prompt-populations/`, { signal })
      .then(res => res.data)
  },
  /** The name labels the experiment condition, e.g. "G4 Proposed". */
  renamePopulation(populationId: number, name: string) {
    return api.patch(`/prompt-populations/${populationId}/`, { name }).then(() => undefined)
  },
  /** Prompts of one population with their raw (snake_case) metadata. */
  fetchPopulationPrompts(populationId: number, signal?: AbortSignal) {
    return api
      .get<{ count: number; results: RawPopulationPrompt[] }>(`/prompt-populations/${populationId}/prompts/`, { signal })
      .then(res => res.data.results)
  },
}
