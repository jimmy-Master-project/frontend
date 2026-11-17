import ElementPlus from 'element-plus'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

// The persona settings panel loads the MatrAIx catalog; stub it out.
vi.mock('@/components/prompts/PersonaPopulationSettings.vue', () => ({
  default: { name: 'PersonaPopulationSettings', props: ['enabled', 'populationSize', 'config', 'objectiveCount'], template: '<div />' },
}))

import PromptAgentConfig from '@/components/prompts/PromptAgentConfig.vue'
import type { PromptGenerationConfig, PromptPopulationSummary } from '@/types'

const config: PromptGenerationConfig = { provider: 'openai_compatible', modelName: 'm', promptCount: 4, temperature: 0.8 }

function population(personaIds: string[]): PromptPopulationSummary {
  return {
    populationId: 3, status: 'completed', errorMessage: '', generationModel: 'm', provider: 'p', temperature: 0.8,
    requested: 4, generated: 4, personaBased: true,
    persona: { enabled: true, pool: 'pool', selectedAttributes: ['gender_identity'], filters: {}, stratify: null, seed: 1,
      personaIds, counterfactualEnabled: true, uniquePersonaCount: 2, reusedPersonas: false } as never,
    personaAttributes: ['gender_identity'], stratifiedBy: null, seed: 1, fairness: {}, generatingPopulationId: null,
  }
}

describe('PromptAgentConfig persona source', () => {
  it('samples at random by default, even after a hand-picked population', async () => {
    const wrapper = mount(PromptAgentConfig, {
      props: { config, generationStatus: 'idle', population: population(['a', 'b']), promptCount: 0 },
      global: { plugins: [ElementPlus] },
    })
    await flushPromises()

    const generate = wrapper.findAll('button').find(button => button.text().includes('Generate'))
    await generate!.trigger('click')

    const [payload] = wrapper.emitted('generate')![0] as [PromptGenerationConfig]
    expect(payload.persona?.enabled).toBe(true)
    expect(payload.persona?.personaIds).toEqual([])
    expect(typeof payload.persona?.seed).toBe('number')
  })
})
