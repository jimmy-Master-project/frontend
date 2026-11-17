import api from './api'
import type { TestPlan, TestPlanRequest } from '@/types'

// One strategy call plus one call per selected technique (and a possible
// control-case retry) run synchronously on the backend, so the default 30 s
// axios timeout is far too short.
export const TEST_PLAN_TIMEOUT_MS = 300_000

export const testPlanApi = {
  generate(evaluationId: string, payload: TestPlanRequest) {
    return api
      .post<TestPlan>(`/evaluations/${evaluationId}/test-plan/`, payload, {
        timeout: TEST_PLAN_TIMEOUT_MS,
      })
      .then(res => res.data)
  },
}
