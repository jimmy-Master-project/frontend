<template>
  <el-card shadow="never" class="result-summary">
    <template #header>
      <div class="header">
        <span>LangFair Metrics</span>
        <div class="actions">
          <ClassificationLabelMapping
            v-if="isClassification"
            v-model:positive="positiveLabel"
            v-model:negative="negativeLabel"
            :labels="classificationLabels"
          />
          <el-button size="small" :loading="loading" :disabled="refreshDisabled" @click="$emit('refresh', refreshPayload)">
            Calculate / Refresh
          </el-button>
        </div>
      </div>
    </template>

    <el-alert
      v-if="connectionLost"
      type="warning"
      :title="CONNECTION_LOST_MESSAGE"
      show-icon
      :closable="false"
      class="state-alert"
    />
    <el-alert
      v-if="loading"
      type="info"
      title="LangFair metrics are being computed in the background. This page updates automatically when they are ready."
      show-icon
      :closable="false"
      class="state-alert"
    />
    <el-alert
      v-if="metrics && isPartial"
      type="warning"
      :title="partialMessage"
      show-icon
      :closable="false"
      class="state-alert"
    />

    <el-alert
      v-if="isClassification && !isBinaryClassification"
      type="warning"
      title="LangFair classification metrics currently support binary classification only. Please use exactly two classification labels."
      show-icon
      :closable="false"
      class="state-alert"
    />
    <el-alert
      v-else-if="error"
      type="error"
      :title="error"
      show-icon
      :closable="false"
      class="state-alert"
    />
    <el-empty
      v-else-if="!metrics"
      :description="loading ? 'Computing LangFair metrics...' : 'Click Calculate / Refresh to load LangFair metrics'"
      :image-size="80"
    />

    <template v-else>
      <div class="metric-grid">
        <div class="metric">
          <span class="label">Run ID</span>
          <span class="value">{{ metrics.runId ?? '—' }}</span>
        </div>
        <div class="metric">
          <span class="label">Task Type</span>
          <span class="value">{{ metrics.taskType ?? '—' }}</span>
        </div>
        <div class="metric">
          <span class="label">Responses</span>
          <span class="value">{{ metrics.responseCount }}</span>
          <small v-if="metrics.excludedResponseCount">
            {{ metrics.excludedResponseCount }} failed/empty responses excluded
          </small>
        </div>
        <div class="metric">
          <span class="label">Executed Suites</span>
          <span class="value">{{ suiteRows.length }}</span>
          <small>{{ selectedSuiteText }}</small>
        </div>
        <div v-if="metrics.computedAt" class="metric">
          <span class="label">Computed At</span>
          <span class="value">{{ formatDateTime(metrics.computedAt) }}</span>
          <small v-if="metrics.language">language: {{ metrics.language }}</small>
        </div>
      </div>

      <el-collapse v-model="openSuites">
        <el-collapse-item v-for="row in suiteRows" :key="row.name" :name="row.name">
          <template #title>
            <div class="suite-title">
              <strong>{{ row.name }}</strong>
              <div class="suite-title-meta">
                <el-tag size="small" type="success">{{ row.details.length }} scores</el-tag>
                <el-tag v-if="row.status" :type="row.status === 'missing_input' ? 'warning' : 'info'" size="small">
                  {{ row.status }}
                </el-tag>
              </div>
            </div>
          </template>

          <MetricSuitePanel :row="row" />
        </el-collapse-item>
      </el-collapse>
    </template>
  </el-card>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import ClassificationLabelMapping from '@/components/responses/ClassificationLabelMapping.vue'
import MetricSuitePanel from '@/components/responses/MetricSuitePanel.vue'
import { CONNECTION_LOST_MESSAGE } from '@/composables/usePolling'
import type { ClassificationLabel, LangFairComputationStatus, LangFairMetricsResult } from '@/types'
import { buildSuiteRows, defaultLabelSelection, toClassificationMapping } from '@/utils/langfairMetrics'

const props = defineProps<{
  metrics: LangFairMetricsResult | null
  loading: boolean
  error: string | null
  runId: string | number | null
  taskType?: string
  classificationLabels?: ClassificationLabel[]
  status?: LangFairComputationStatus
  partial?: boolean
  runStatus?: string | null
  connectionLost?: boolean
}>()

defineEmits<{
  refresh: [mapping?: { positiveLabels: number[]; negativeLabels: number[] }]
}>()

const positiveLabel = ref<number | null>(null)
const negativeLabel = ref<number | null>(null)

const openSuites = ref<string[]>([])

const selectedSuiteText = computed(() => props.metrics?.selectedSuites?.join(', ') || 'task-based defaults')
const isClassification = computed(() => props.taskType === 'classification')
const isBinaryClassification = computed(() => (props.classificationLabels?.length ?? 0) === 2)
const classificationMapping = computed(() => toClassificationMapping(positiveLabel.value, negativeLabel.value))
const refreshPayload = computed(() => (isClassification.value ? classificationMapping.value : undefined))
const refreshDisabled = computed(() => {
  return !props.runId || (
    isClassification.value && (
      !isBinaryClassification.value ||
      positiveLabel.value === null ||
      negativeLabel.value === null ||
      positiveLabel.value === negativeLabel.value
    )
  )
})

const isPartial = computed(() => props.partial || props.metrics?.partial === true)
const partialMessage = computed(() => {
  const runStatus = props.runStatus || props.metrics?.runStatus
  const suffix = runStatus ? `（run 狀態：${runStatus}）` : ''
  return `這些指標是以尚未完整完成的 run 計算的部分結果${suffix}，數值可能在 run 補齊後改變。`
})

const suiteRows = computed(() => buildSuiteRows(props.metrics))

function formatDateTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

watch(
  () => props.classificationLabels,
  labels => {
    const { positive, negative } = defaultLabelSelection(labels)
    positiveLabel.value = positive
    negativeLabel.value = negative
  },
  { immediate: true },
)

watch(
  suiteRows,
  rows => {
    openSuites.value = rows.map(row => row.name)
  },
  { immediate: true },
)
</script>

<style scoped>
.result-summary {
  margin-bottom: 20px;
}
.header,
.suite-title,
.actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  width: 100%;
}
.actions {
  justify-content: flex-end;
}
.suite-title-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}
.state-alert {
  margin-bottom: 12px;
}
.metric-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
.metric {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.metric .label {
  color: var(--el-text-color-secondary);
}
.metric .value {
  font-size: 18px;
  font-weight: 700;
}
@media (max-width: 900px) {
  .metric-grid {
    grid-template-columns: repeat(1, minmax(0, 1fr));
  }
}
</style>
