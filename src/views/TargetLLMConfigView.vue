<template>
  <div class="target-llm-view">
    <EvaluationStepper :active="2" />
    <h2>Target LLM</h2>
    <p class="description">Configure the model that will receive the generated Prompt Population.</p>

    <el-alert v-if="pastRuns.length" type="info" :closable="false" show-icon class="form-card">
      <template #title>
        This evaluation has {{ pastRuns.length }} run(s); the latest used {{ latestModel }}.
      </template>
      Saving a different model here does not change past results. Save, then start a new run to evaluate the new
      model on the same prompt population, and compare them in
      <router-link :to="{ name: 'run-history', params: { evaluationId } }">Run history</router-link>.
    </el-alert>

    <LoadingState v-if="loading" text="Loading configuration..." />
    <el-card v-else shadow="never" class="form-card">
      <div class="preset-row">
        <span class="preset-label">Preset</span>
        <el-select
          v-model="selectedPresetId"
          placeholder="Load a saved Target LLM"
          filterable
          clearable
          class="preset-select"
          @change="(id: string) => id && applyPreset(id)"
        >
          <el-option v-for="preset in llmPresets.presets.value" :key="preset.id" :label="preset.name" :value="preset.id" />
        </el-select>
        <el-button text :disabled="!llmStore.modelName" @click="savePreset">Save current as preset</el-button>
        <el-button text type="danger" :disabled="!selectedPresetId" @click="deletePreset">Delete</el-button>
      </div>
      <el-divider />
      <TargetLLMConfigForm
        :model-value="configValues"
        :evaluation-id="evaluationId"
        :saving="llmStore.saving"
        :testing="llmStore.testing"
        :test-result="llmStore.testResult"
        @save="handleSave"
        @test="handleTest"
      />
    </el-card>

    <div class="page-nav">
      <el-button @click="router.push(`/evaluations/${evaluationId}/prompts`)">← Prompt Population</el-button>
      <el-button type="primary" @click="router.push(`/evaluations/${evaluationId}/run`)">
        {{ pastRuns.length ? 'Run again →' : 'Run Evaluation →' }}
      </el-button>
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
import { useLlmPresets } from '@/composables/useLlmPresets'
import { formatApiError } from '@/services/api'
import { runApi } from '@/services/runApi'
import { useLlmConfigStore } from '@/stores/llmConfig'
import type { LLMConfig, RunStatus } from '@/types'

const route = useRoute()
const router = useRouter()
const evaluationId = computed(() => String(route.params.evaluationId))

const llmStore = useLlmConfigStore()
// Drop form values left over from another evaluation before rendering.
llmStore.ensureEvaluation(evaluationId.value)
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

// Past runs keep their own Target LLM snapshot; shown so a swap is deliberate.
const pastRuns = ref<RunStatus[]>([])
const latestModel = computed(() => pastRuns.value[0]?.llmSnapshot?.modelName || 'an unrecorded model')

// Presets shared with the flow editor's Target LLM nodes.
const llmPresets = useLlmPresets()
const selectedPresetId = ref('')
function applyPreset(id: string) {
  const merged = llmPresets.applyTo(id, configValues.value)
  if (!merged) return
  Object.assign(llmStore, {
    provider: merged.provider,
    modelName: merged.modelName,
    baseUrl: merged.baseUrl,
    apiKey: merged.apiKey ?? '',
    temperature: merged.temperature,
    topP: merged.topP,
    maxTokens: merged.maxTokens,
    generationsPerPrompt: merged.generationsPerPrompt,
  })
  ElMessage.info(`Loaded preset "${llmPresets.find(id)?.name}". Save to apply it to this evaluation.`)
}
async function savePreset() {
  const saved = await llmPresets.promptAndSave(configValues.value)
  if (!saved) return
  selectedPresetId.value = saved.id
  ElMessage.success(`Preset "${saved.name}" saved (API key not stored).`)
}
function deletePreset() {
  llmPresets.remove(selectedPresetId.value)
  selectedPresetId.value = ''
}

onMounted(async () => {
  void runApi.listRuns(evaluationId.value).then(runs => (pastRuns.value = runs), () => undefined)
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
    ElMessage.success(pastRuns.value.length ? 'Configuration saved. Start a new run to evaluate this model.' : 'Configuration saved.')
  } catch (e) {
    ElMessage.error(formatApiError(e, 'Failed to save LLM configuration.'))
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
.preset-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.preset-label {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.preset-select {
  width: 260px;
}
.page-nav {
  display: flex;
  justify-content: space-between;
  max-width: 640px;
}
</style>
