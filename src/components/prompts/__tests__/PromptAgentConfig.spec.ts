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

describe('PromptAgentConfig load settings', () => {
  it('reproduces an earlier population and lets the persona switch be the only change', async () => {
    const wrapper = mount(PromptAgentConfig, {
      props: { config, generationStatus: 'completed', population: population([]), promptCount: 4 },
      global: { plugins: [ElementPlus] },
    })
    ;(wrapper.vm as unknown as { applySettings: (r: Partial<PromptGenerationConfig>, l: string) => void }).applySettings(
      {
        provider: 'openai_compatible', modelName: 'gen-model', promptCount: 7, temperature: 0.3, additionalInstruction: 'short',
        persona: { enabled: true, selectedAttributes: ['gender_identity'], filters: {}, stratify: null, seed: 123, counterfactualEnabled: true },
      },
      'G2 #3',
    )
    await flushPromises()
    await wrapper.find('[data-test="persona-switch"]').findAll('input')[1].setValue(true)
    await flushPromises()
    const generate = wrapper.findAll('button').find(button => button.text().includes('Generate New Population'))
    await generate!.trigger('click')

    const [payload] = wrapper.emitted('generate')![0] as [PromptGenerationConfig]
    expect(payload).toMatchObject({ modelName: 'gen-model', promptCount: 7, temperature: 0.3, additionalInstruction: 'short' })
    expect(payload.persona?.enabled).toBe(false)
    expect(payload.counterfactualTemplate).toBe(true)
  })
})
