import { defineStore } from 'pinia'
import { ref } from 'vue'

import { llmConfigApi, type TestConnectionResult } from '@/services/llmConfigApi'
import type { LLMConfig, Provider } from '@/types'

export const useLlmConfigStore = defineStore('llmConfig', () => {
  const provider = ref<Provider>('openai_compatible')
  const modelName = ref('')
  const baseUrl = ref('')
  const apiKey = ref('')
  const temperature = ref(0.7)
  const topP = ref(0.9)
  const maxTokens = ref(512)
  const generationsPerPrompt = ref(1)

  const loading = ref(false)
  const saving = ref(false)
  const testing = ref(false)
  const error = ref<string | null>(null)
  const testResult = ref<TestConnectionResult | null>(null)

  function applyConfig(config: LLMConfig) {
    provider.value = config.provider
    modelName.value = config.modelName
    baseUrl.value = config.baseUrl
    temperature.value = config.temperature
    topP.value = config.topP
    maxTokens.value = config.maxTokens
    generationsPerPrompt.value = config.generationsPerPrompt
  }

  function toPayload(): LLMConfig {
    return {
      provider: provider.value,
      modelName: modelName.value,
      baseUrl: baseUrl.value,
      apiKey: apiKey.value || undefined,
      temperature: temperature.value,
      topP: topP.value,
      maxTokens: maxTokens.value,
      generationsPerPrompt: generationsPerPrompt.value,
    }
  }

  async function fetchConfig(evaluationId: string) {
    loading.value = true
    error.value = null
    try {
      const config = await llmConfigApi.fetchConfig(evaluationId)
      applyConfig(config)
    } catch (e) {
      error.value = 'Failed to load LLM configuration.'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function saveConfig(evaluationId: string) {
    saving.value = true
    error.value = null
    try {
      const config = await llmConfigApi.saveConfig(evaluationId, toPayload())
      applyConfig(config)
      apiKey.value = ''
      return config
    } catch (e) {
      error.value = 'Failed to save LLM configuration.'
      throw e
    } finally {
      saving.value = false
    }
  }

  async function testConnection(evaluationId: string) {
    testing.value = true
    testResult.value = null
    try {
      testResult.value = await llmConfigApi.testConnection(evaluationId)
    } catch {
      testResult.value = { success: false, message: 'Unable to connect to model endpoint.' }
    } finally {
      testing.value = false
    }
    return testResult.value
  }

  return {
    provider,
    modelName,
    baseUrl,
    apiKey,
    temperature,
    topP,
    maxTokens,
    generationsPerPrompt,
    loading,
    saving,
    testing,
    error,
    testResult,
    fetchConfig,
    saveConfig,
    testConnection,
  }
})
