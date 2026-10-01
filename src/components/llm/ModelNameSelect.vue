<template>
  <div class="model-name-select">
    <el-select
      :model-value="modelValue"
      filterable
      allow-create
      default-first-option
      clearable
      :loading="loading"
      :placeholder="placeholder"
      style="width: 100%"
      @update:model-value="(value: string) => emit('update:modelValue', value ?? '')"
    >
      <el-option v-for="model in options" :key="model" :label="model" :value="model" />
    </el-select>
    <div class="hint" :class="{ warn: !!error }">
      <template v-if="loading">正在向 API 取得模型清單…</template>
      <template v-else-if="error">無法取得模型清單（{{ error }}），可直接輸入模型名稱。</template>
      <template v-else-if="models.length">已從 API 取得 {{ models.length }} 個模型，也可直接輸入。</template>
      <template v-else-if="fetched">API 沒有回傳模型，可直接輸入模型名稱。</template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { formatApiError } from '@/services/api'
import { llmModelsApi } from '@/services/llmConfigApi'
import type { Provider } from '@/types'

const props = defineProps<{
  modelValue: string
  provider: Provider
  baseUrl: string
  apiKey?: string
  evaluationId?: string | null
  placeholder?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const models = ref<string[]>([])
const error = ref<string | null>(null)
const loading = ref(false)
const fetched = ref(false)

// Keep the current value selectable even when the endpoint doesn't list it
// (e.g. a bot that has no /models endpoint).
const options = computed(() =>
  props.modelValue && !models.value.includes(props.modelValue)
    ? [props.modelValue, ...models.value]
    : models.value,
)

let timer: ReturnType<typeof setTimeout> | undefined
let controller: AbortController | undefined

async function refresh() {
  controller?.abort()
  if (!props.evaluationId) return
  const current = new AbortController()
  controller = current
  loading.value = true
  try {
    const result = await llmModelsApi.list(
      props.evaluationId,
      { provider: props.provider, baseUrl: props.baseUrl, apiKey: props.apiKey || undefined },
      current.signal,
    )
    if (current.signal.aborted) return
    models.value = result.models
    error.value = result.error
    // Single-model endpoints (e.g. the EVA Air bot) need no choice.
    if (!props.modelValue && result.models.length === 1) emit('update:modelValue', result.models[0])
  } catch (err) {
    if (current.signal.aborted) return
    models.value = []
    error.value = formatApiError(err)
  } finally {
    if (!current.signal.aborted) {
      loading.value = false
      fetched.value = true
    }
  }
}

watch(
  () => [props.evaluationId, props.provider, props.baseUrl, props.apiKey],
  () => {
    clearTimeout(timer)
    timer = setTimeout(refresh, 500)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  clearTimeout(timer)
  controller?.abort()
})
</script>

<style scoped>
.model-name-select {
  width: 100%;
}
.hint {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--el-text-color-secondary);
}
.hint.warn {
  color: var(--el-color-warning);
}
</style>
