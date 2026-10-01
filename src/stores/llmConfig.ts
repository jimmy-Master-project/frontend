import { defineStore } from 'pinia'
import { ref } from 'vue'

import { formatApiError } from '@/services/api'
import { llmConfigApi, type TestConnectionResult } from '@/services/llmConfigApi'
import type { LLMConfig, Provider } from '@/types'

const DEFAULT_CONFIG: LLMConfig = {
  provider: 'openai_compatible',
  modelName: '',
  baseUrl: '',
  temperature: 0.7,
  topP: 0.9,
  maxTokens: 512,
  generationsPerPrompt: 1,
}

export const useLlmConfigStore = defineStore('llmConfig', () => {
  const currentEvaluationId = ref<string | null>(null)
  const provider = ref<Provider>(DEFAULT_CONFIG.provider)
  const modelName = ref(DEFAULT_CONFIG.modelName)
  const baseUrl = ref(DEFAULT_CONFIG.baseUrl)
  const apiKey = ref('')
  const temperature = ref(DEFAULT_CONFIG.temperature)
  const topP = ref(DEFAULT_CONFIG.topP)
  const maxTokens = ref(DEFAULT_CONFIG.maxTokens)
  const generationsPerPrompt = ref(DEFAULT_CONFIG.generationsPerPrompt)

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

  function isCurrent(evaluationId: string) {
    return currentEvaluationId.value === evaluationId
  }

  /**
   * Binds the store to an evaluation. Switching evaluation resets the form to
   * defaults, so a failed fetch never leaves another evaluation's values.
   */
  function ensureEvaluation(evaluationId: string | number) {
    const id = String(evaluationId)
    if (currentEvaluationId.value !== id) {
      reset()
      currentEvaluationId.value = id
    }
    return id
  }

  async function fetchConfig(evaluationId: string | number) {
    const id = ensureEvaluation(evaluationId)
    loading.value = true
    error.value = null
    try {
      const config = await llmConfigApi.fetchConfig(id)
      if (!isCurrent(id)) return
      applyConfig(config)
    } catch (e) {
      if (isCurrent(id)) error.value = formatApiError(e, 'Failed to load LLM configuration.')
      throw e
    } finally {
      if (isCurrent(id)) loading.value = false
    }
  }

  async function saveConfig(evaluationId: string | number) {
    const id = ensureEvaluation(evaluationId)
    saving.value = true
    error.value = null
    try {
      const config = await llmConfigApi.saveConfig(id, toPayload())
      if (!isCurrent(id)) return config
      applyConfig(config)
      apiKey.value = ''
      return config
    } catch (e) {
      if (isCurrent(id)) error.value = formatApiError(e, 'Failed to save LLM configuration.')
      throw e
    } finally {
      if (isCurrent(id)) saving.value = false
    }
  }

  async function testConnection(evaluationId: string | number) {
    const id = ensureEvaluation(evaluationId)
    testing.value = true
    testResult.value = null
    let result: TestConnectionResult
    try {
      result = await llmConfigApi.testConnection(id)
    } catch (e) {
      result = { success: false, message: formatApiError(e, 'Unable to connect to model endpoint.') }
    }
    if (isCurrent(id)) {
      testResult.value = result
      testing.value = false
    }
    return result
  }

  function reset() {
    currentEvaluationId.value = null
    applyConfig(DEFAULT_CONFIG)
    apiKey.value = ''
    loading.value = false
    saving.value = false
    testing.value = false
    error.value = null
    testResult.value = null
  }

  return {
    currentEvaluationId,
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
    ensureEvaluation,
    fetchConfig,
    saveConfig,
    testConnection,
    reset,
  }
})
