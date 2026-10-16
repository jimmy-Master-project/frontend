<template>
  <div class="fairness-metrics-view">
    <EvaluationStepper :active="4" />
    <div class="page-header">
      <div>
        <h2>Fairness Metrics</h2>
        <p>LangFair 指標分析結果會在此頁面獨立呈現。</p>
      </div>
      <div class="header-actions">
        <RunExportMenu :run-id="responsesStore.runId" />
        <el-button @click="router.push({ path: `/evaluations/${evaluationId}/responses`, query: runQuery })">Back to Responses</el-button>
      </div>
    </div>
    <RunSelect :evaluation-id="evaluationId" :model-value="responsesStore.selectedRunId" @update:model-value="changeRun" />

    <LoadingState v-if="responsesStore.loading" text="Loading evaluation metadata..." />
    <ErrorState v-else-if="responsesStore.error" :message="responsesStore.error" @retry="load" />
    <EvaluationResultSummary
      v-else
      :metrics="responsesStore.langFairMetrics"
      :loading="responsesStore.langFairLoading"
      :error="responsesStore.langFairError"
      :status="responsesStore.langFairStatus"
      :partial="responsesStore.langFairPartial"
      :run-status="responsesStore.langFairRunStatus"
      :connection-lost="responsesStore.langFairConnectionLost"
      :run-id="responsesStore.runId"
      :task-type="responsesStore.taskType"
      :classification-labels="responsesStore.classificationLabels"
      @refresh="loadLangFairMetrics"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import EvaluationStepper from '@/components/common/EvaluationStepper.vue'
import ErrorState from '@/components/common/ErrorState.vue'
import LoadingState from '@/components/common/LoadingState.vue'
import EvaluationResultSummary from '@/components/responses/EvaluationResultSummary.vue'
import RunExportMenu from '@/components/run/RunExportMenu.vue'
import RunSelect from '@/components/run/RunSelect.vue'
import { useUnmountSignal } from '@/composables/usePolling'
import { useResponsesStore } from '@/stores/responses'
import { defaultClassificationMapping } from '@/utils/langfairMetrics'

const route = useRoute()
const router = useRouter()
const evaluationId = computed(() => String(route.params.evaluationId))
const unmountSignal = useUnmountSignal()
const responsesStore = useResponsesStore()
responsesStore.enterEvaluation(evaluationId.value)
if (typeof route.query.runId === 'string') responsesStore.selectRun(route.query.runId)
const runQuery = computed(() => (responsesStore.selectedRunId ? { runId: responsesStore.selectedRunId } : {}))

function changeRun(runId: string | null) {
  responsesStore.selectRun(runId)
  void router.replace({ query: runId ? { runId } : {} })
  void load()
}

async function load() {
  try {
    await responsesStore.fetchResponses(evaluationId.value, unmountSignal)
  } catch {
    // Store state already contains the user-facing error.
    return
  }
  if (unmountSignal.aborted) return
  // Show an already computed result (or resume polling a running one)
  // without triggering a new computation.
  const mapping = responsesStore.taskType === 'classification'
    ? defaultClassificationMapping(responsesStore.classificationLabels)
    : undefined
  await responsesStore.loadCachedLangFairMetrics(mapping, undefined, unmountSignal)
}

function loadLangFairMetrics(mapping?: { positiveLabels: number[]; negativeLabels: number[] }) {
  responsesStore.fetchLangFairMetrics(mapping, undefined, unmountSignal).catch(() => {})
}

onMounted(load)
onUnmounted(() => responsesStore.stopLangFairPolling())
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}
.header-actions {
  display: flex;
  gap: 12px;
}
.page-header h2 {
  margin-bottom: 4px;
}
.page-header p {
  margin: 0;
  color: var(--el-text-color-secondary);
}
</style>
