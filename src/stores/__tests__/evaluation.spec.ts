import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const update = vi.fn()
vi.mock('@/services/evaluationApi', () => ({
  evaluationApi: { update: (...args: unknown[]) => update(...args) },
}))

import { useEvaluationStore } from '@/stores/evaluation'

const evaluation = {
  id: '3',
  name: 'Airline',
  useCaseDescription: 'Airline customer service',
  taskType: 'text_generation',
  language: 'en',
  status: 'draft',
  promptCount: 0,
  createdAt: '',
}

describe('evaluation store setTaskObjectives', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    update.mockReset()
  })

  it('does nothing without a loaded evaluation', async () => {
    await useEvaluationStore().setTaskObjectives([{ objective: 'x' }])
    expect(update).not.toHaveBeenCalled()
  })

  it('patches the objectives and stores the server result', async () => {
    const store = useEvaluationStore()
    store.evaluationId = '3'
    const objectives = [{ objective: 'The user asks for a refund.', technique: 'boundary_value' as const }]
    update.mockResolvedValue({ ...evaluation, taskObjectives: objectives })

    await store.setTaskObjectives(objectives)

    expect(update).toHaveBeenCalledWith('3', { taskObjectives: objectives })
    expect(store.taskObjectives).toEqual(objectives)
  })
})
