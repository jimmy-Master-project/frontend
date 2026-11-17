import ElementPlus from 'element-plus'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const listPopulations = vi.fn()
const fetchPopulationPrompts = vi.fn()
const renamePopulation = vi.fn()
vi.mock('@/services/experimentApi', () => ({
  experimentApi: {
    listPopulations: (...args: unknown[]) => listPopulations(...args),
    fetchPopulationPrompts: (...args: unknown[]) => fetchPopulationPrompts(...args),
    renamePopulation: (...args: unknown[]) => renamePopulation(...args),
  },
}))

import PopulationComparison from '@/components/prompts/PopulationComparison.vue'

const templatePrompts = [
  { id: 1, text: "I'm a woman. Can I get a refund?", metadata: { task_objective: 'Refund', persona_id: 'template',
    fairness: { pair_id: 'a', role: 'original', group: 'female', method: 'template' } } },
  { id: 2, text: "I'm a man. Can I get a refund?", metadata: { task_objective: 'Refund', persona_id: 'template',
    fairness: { pair_id: 'a', role: 'counterfactual', group: 'male', method: 'template' } } },
]

describe('PopulationComparison', () => {
  beforeEach(() => {
    listPopulations.mockReset().mockResolvedValue([
      { populationId: 5, name: 'G1 Baseline', status: 'completed', generated: 2, generationMode: 'template_counterfactual',
        generationModel: 'gpt-4o-mini', generationStats: { llmCalls: 1, seconds: 2 }, fairness: {} },
      { populationId: 4, name: '', status: 'failed', generated: 0, generationMode: '', generationModel: 'gpt-4o-mini',
        fairness: {} },
    ])
    fetchPopulationPrompts.mockReset().mockResolvedValue(templatePrompts)
    renamePopulation.mockReset().mockResolvedValue(undefined)
  })

  function mountIt() {
    return mount(PopulationComparison, {
      props: { evaluationId: '9', currentPopulationId: 5 },
      global: { plugins: [ElementPlus] },
      attachTo: document.body,
    })
  }

  it('lists the populations of the evaluation and renames a condition', async () => {
    const wrapper = mountIt()
    await flushPromises()

    expect(listPopulations).toHaveBeenCalledWith('9')
    const table = wrapper.get('[data-test="population-table"]').text()
    expect(table).toContain('template pairs')
    expect(table).toContain('shown above')

    const field = wrapper.get('[data-test="name-5"]')
    const input = field.element.tagName === 'INPUT' ? field : field.get('input')
    await input.setValue('G3 Agent-only')
    await input.trigger('change')
    await flushPromises()
    expect(renamePopulation).toHaveBeenCalledWith(5, 'G3 Agent-only')
  })

  it('compares the selected populations', async () => {
    const wrapper = mountIt()
    await flushPromises()

    // Select the completed population via its row checkbox.
    await wrapper.findAll('[data-test="population-table"] tbody .el-checkbox')[0].trigger('click')
    await flushPromises()
    await wrapper.get('[data-test="compare"]').trigger('click')
    await flushPromises()

    expect(fetchPopulationPrompts).toHaveBeenCalledWith(5)
    const metrics = wrapper.get('[data-test="metrics-table"]').text()
    expect(metrics).toContain('G1 Baseline')
    expect(metrics).toContain('100%')
  })
})
