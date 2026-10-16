import { ElMessageBox } from 'element-plus'
import { ref, watch } from 'vue'

import type { LLMConfig } from '@/types'
import { flowStorageKeys, readFlowJson, writeFlowJson } from '@/utils/flowStorage'

/** A reusable Target LLM config, shared by every evaluation (never with an API key). */
export interface LlmPreset {
  id: string
  name: string
  config: LLMConfig
}

function readPresets(): LlmPreset[] {
  const saved = readFlowJson(flowStorageKeys.botPresets())
  return Array.isArray(saved)
    ? saved.filter((item): item is LlmPreset => !!item && typeof item.id === 'string' && typeof item.name === 'string' && !!item.config)
    : []
}

/**
 * Target LLM presets kept in localStorage. Used by the flow editor's Target
 * LLM nodes and the step view's Target LLM page, so a model saved in one is
 * available in the other.
 */
export function useLlmPresets() {
  const presets = ref<LlmPreset[]>(readPresets())
  watch(presets, value => writeFlowJson(flowStorageKeys.botPresets(), value), { deep: true })

  function find(id: string) {
    return presets.value.find(item => item.id === id)
  }

  /** `current` merged with the preset; a key typed for the same endpoint is kept. */
  function applyTo(id: string, current: LLMConfig): LLMConfig | null {
    const preset = find(id)
    if (!preset) return null
    const apiKey = current.baseUrl === preset.config.baseUrl ? current.apiKey : ''
    return { ...current, ...preset.config, apiKey }
  }

  /** Asks for a name, then saves (or overwrites the same-named) preset. Returns its id. */
  async function promptAndSave(config: LLMConfig): Promise<{ id: string; name: string } | null> {
    let name: string
    try {
      const result = await ElMessageBox.prompt('Preset name', 'Save Target LLM preset', {
        inputValue: `${config.provider} · ${config.modelName.trim()}`,
        inputValidator: value => !!value?.trim() || 'Enter a name.',
      })
      name = result.value.trim()
    } catch {
      return null
    }
    const existing = presets.value.find(item => item.name === name)
    const preset: LlmPreset = {
      id: existing?.id ?? crypto.randomUUID(),
      name,
      config: { ...config, modelName: config.modelName.trim(), apiKey: '' },
    }
    presets.value = [...presets.value.filter(item => item.id !== preset.id), preset]
    return { id: preset.id, name }
  }

  function remove(id: string) {
    presets.value = presets.value.filter(item => item.id !== id)
  }

  return { presets, find, applyTo, promptAndSave, remove }
}
