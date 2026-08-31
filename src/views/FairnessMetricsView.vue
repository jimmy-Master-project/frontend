<template>
  <div class="fairness-metrics-view">
    <EvaluationStepper :active="4" />
    <div class="page-header">
      <div>
        <h2>Fairness Metrics</h2>
        <p>LangFair 指標分析結果會在此頁面獨立呈現。</p>
      </div>
      <el-button @click="router.push(`/evaluations/${evaluationId}/responses`)">Back to Responses</el-button>
    </div>

    <LoadingState v-if="responsesStore.loading" text="Loading evaluation metadata..." />
    <ErrorState v-else-if="responsesStore.error" :message="responsesStore.error" @retry="load" />
    <EvaluationResultSummary
      v-else
      :metrics="responsesStore.langFairMetrics"
      :loading="responsesStore.langFairLoading"
      :error="responsesStore.langFairError"
      :run-id="responsesStore.runId"
      :task-type="responsesStore.taskType"
      :classification-labels="responsesStore.classificationLabels"
      @refresh="loadLangFairMetrics"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import EvaluationStepper from '@/components/common/EvaluationStepper.vue'
import ErrorState from '@/components/common/ErrorState.vue'
import LoadingState from '@/components/common/LoadingState.vue'
import EvaluationResultSummary from '@/components/responses/EvaluationResultSummary.vue'
import { useResponsesStore } from '@/stores/responses'

const route = useRoute()
const router = useRouter()
const evaluationId = computed(() => route.params.evaluationId as string)
const responsesStore = useResponsesStore()

async function load() {
  try {
    await responsesStore.fetchResponses(evaluationId.value)
  } catch {
    // Store state already contains the user-facing error.
  }
}

function loadLangFairMetrics(mapping?: { positiveLabels: number[]; negativeLabels: number[] }) {
  responsesStore.fetchLangFairMetrics(mapping).catch(() => {})
}

onMounted(load)
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}
.page-header h2 {
  margin-bottom: 4px;
}
.page-header p {
  margin: 0;
  color: var(--el-text-color-secondary);
}
</style>
