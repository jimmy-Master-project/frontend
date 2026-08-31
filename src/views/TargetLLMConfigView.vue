<template>
  <div class="target-llm-view">
    <EvaluationStepper :active="2" />
    <h2>Target LLM</h2>
    <p class="description">Configure the model that will receive the generated Prompt Population.</p>

    <LoadingState v-if="loading" text="Loading configuration..." />
    <el-card v-else shadow="never" class="form-card">
      <TargetLLMConfigForm
        :model-value="configValues"
        :saving="llmStore.saving"
        :testing="llmStore.testing"
        :test-result="llmStore.testResult"
        @save="handleSave"
        @test="handleTest"
      />
    </el-card>

    <div class="page-nav">
      <el-button @click="router.push(`/evaluations/${evaluationId}/prompts`)">← Prompt Population</el-button>
      <el-button type="primary" @click="router.push(`/evaluations/${evaluationId}/run`)">Run Evaluation →</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import EvaluationStepper from '@/components/common/EvaluationStepper.vue'
import LoadingState from '@/components/common/LoadingState.vue'
import TargetLLMConfigForm from '@/components/llm/TargetLLMConfigForm.vue'
import { useLlmConfigStore } from '@/stores/llmConfig'
import type { LLMConfig } from '@/types'

const route = useRoute()
const router = useRouter()
const evaluationId = computed(() => route.params.evaluationId as string)

const llmStore = useLlmConfigStore()
const loading = ref(true)

const configValues = computed<LLMConfig>(() => ({
  provider: llmStore.provider,
  modelName: llmStore.modelName,
  baseUrl: llmStore.baseUrl,
  apiKey: llmStore.apiKey,
  temperature: llmStore.temperature,
  topP: llmStore.topP,
  maxTokens: llmStore.maxTokens,
  generationsPerPrompt: llmStore.generationsPerPrompt,
}))

onMounted(async () => {
  try {
    await llmStore.fetchConfig(evaluationId.value)
  } catch {
    // No existing configuration yet; keep the form defaults.
  } finally {
    loading.value = false
  }
})

async function handleSave(config: LLMConfig) {
  llmStore.provider = config.provider
  llmStore.modelName = config.modelName
  llmStore.baseUrl = config.baseUrl
  llmStore.apiKey = config.apiKey ?? ''
  llmStore.temperature = config.temperature
  llmStore.topP = config.topP
  llmStore.maxTokens = config.maxTokens
  llmStore.generationsPerPrompt = config.generationsPerPrompt
  try {
    await llmStore.saveConfig(evaluationId.value)
    ElMessage.success('Configuration saved.')
  } catch {
    ElMessage.error('Failed to save LLM configuration.')
  }
}

async function handleTest() {
  await llmStore.testConnection(evaluationId.value)
}
</script>

<style scoped>
.description {
  color: var(--el-text-color-secondary);
  margin-bottom: 20px;
}
.form-card {
  max-width: 640px;
  margin-bottom: 24px;
}
.page-nav {
  display: flex;
  justify-content: space-between;
  max-width: 640px;
}
</style>
