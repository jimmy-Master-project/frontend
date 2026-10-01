<template>
  <div class="benchmark-view">
    <div class="page-header">
      <div>
        <h2>Dataset Validation</h2>
        <p>Run an isolated DialogSum gender counterfactual validation against the configured Target LLM.</p>
      </div>
      <el-button @click="router.push('/')">Back to Dashboard</el-button>
    </div>

    <el-card shadow="never">
      <el-form label-position="top" @submit.prevent="runValidation">
        <el-form-item label="Dataset">
          <el-input model-value="DialogSum / gender" disabled />
        </el-form-item>
        <el-form-item label="Counterfactual pairs">
          <el-input-number v-model="pairCount" :min="1" :max="100" />
          <p class="help">Each pair produces two prompts and two Target LLM responses.</p>
        </el-form-item>
        <el-form-item label="Sampling seed">
          <el-input-number v-model="seed" :min="0" />
        </el-form-item>
        <el-alert
          title="Dialogues are sampled locally from dialogsum/DialogSum_Data/dialogsum.test.jsonl. The same dialogue is used for both groups; only the controlled gender instruction changes."
          type="info"
          :closable="false"
          show-icon
        />
        <el-button class="run-button" type="primary" :loading="loading" @click="runValidation">
          Start DialogSum Validation
        </el-button>
      </el-form>
    </el-card>

    <el-card shadow="never" class="source-card">
      <template #header>Virtual Persona Prompt Population</template>
      <p>
        Generate the comparison population with the existing Virtual Persona flow. Persona is enabled by default and
        gender_identity is selected for counterfactual pairing.
      </p>
      <el-button type="primary" plain @click="router.push('/evaluations/new?source=virtual-persona-validation')">
        Create Virtual Persona Population
      </el-button>
    </el-card>

    <el-alert v-if="error" class="state-alert" type="error" :title="error" show-icon :closable="false" />
    <el-card v-if="result" shadow="never" class="result-card">
      <h3>Validation started</h3>
      <p>{{ result.pairCount }} pairs / {{ result.promptCount }} prompts</p>
      <el-button type="primary" @click="router.push(`/evaluations/${result.evaluationId}/run`)">
        Open Run Progress
      </el-button>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { formatApiError } from '@/services/api'
import { benchmarkApi, type DialogSumValidationResponse } from '@/services/benchmarkApi'

const router = useRouter()
const pairCount = ref(100)
const seed = ref(42)
const loading = ref(false)
const error = ref<string | null>(null)
const result = ref<DialogSumValidationResponse | null>(null)

async function runValidation() {
  loading.value = true
  error.value = null
  try {
    result.value = await benchmarkApi.runDialogSum({ domain: 'gender', pairCount: pairCount.value, seed: seed.value })
  } catch (err) {
    error.value = formatApiError(err, 'Unable to start DialogSum validation.')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 20px; }
.page-header h2 { margin-bottom: 4px; }
.page-header p, .help { color: var(--el-text-color-secondary); }
.run-button { margin-top: 20px; }
.state-alert, .result-card, .source-card { margin-top: 20px; }
</style>
