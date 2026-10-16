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
      v-if="metrics && isPartial && !loading"
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
    <!-- Results are shown only once the computation has finished. -->
    <div v-else-if="loading" class="computing">
      <el-icon class="is-loading" :size="32"><Loading /></el-icon>
      <strong>公平性指標計算中</strong>
      <p>計算完成後會自動顯示結果；回應較多時可能需要數分鐘。</p>
    </div>
    <el-empty
      v-else-if="!metrics"
:description="runStatus && runStatus !== 'completed' ? 'Run 尚未完成；完成後會自動開始計算公平性指標。' : '尚未計算公平性指標，請按 Calculate / Refresh'"
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

      <el-alert
        v-if="metrics.languageCheck && !metrics.languageCheck.isEnglish"
        type="error"
        show-icon
        :closable="false"
        class="language-alert"
        :title="`${metrics.languageCheck.nonEnglishResponseCount} / ${metrics.languageCheck.checkedResponseCount} 筆回覆不是英文（ASCII 字母比例 < ${metrics.languageCheck.asciiRatioThreshold}），LangFair 只支援英文，整個 run 的所有 suite 皆已拒絕計算。`"
      />

      <FairnessOverview :rows="suiteRows" @open-suite="openSuite" />

      <h4 class="details-heading">細部數據</h4>
      <el-collapse v-model="openSuites">
        <el-collapse-item v-for="row in suiteRows" :key="row.name" :name="row.name">
          <template #title>
            <div class="suite-title">
              <strong>{{ row.name }}</strong>
              <div class="suite-title-meta">
                <el-tag v-if="flaggedCount(row)" size="small" type="warning">{{ flaggedCount(row) }} 超過閾值</el-tag>
                <el-tag size="small" type="info">{{ row.details.length }} scores</el-tag>
                <el-tag
                  v-if="row.status"
                  :type="row.status === 'unsupported_language' ? 'danger' : row.status === 'missing_input' ? 'warning' : 'info'"
                  size="small"
                >
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

import { Loading } from '@element-plus/icons-vue'

import ClassificationLabelMapping from '@/components/responses/ClassificationLabelMapping.vue'
import FairnessOverview from '@/components/responses/FairnessOverview.vue'
import MetricSuitePanel from '@/components/responses/MetricSuitePanel.vue'
import { CONNECTION_LOST_MESSAGE } from '@/composables/usePolling'
import type { ClassificationLabel, LangFairComputationStatus, LangFairMetricsResult } from '@/types'
import { buildSuiteRows, defaultLabelSelection, toClassificationMapping, type SuiteRow } from '@/utils/langfairMetrics'

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

// Details stay collapsed; the overview links into them.
watch(suiteRows, () => (openSuites.value = []), { immediate: true })

function openSuite(name: string) {
  if (!openSuites.value.includes(name)) openSuites.value = [...openSuites.value, name]
}

function flaggedCount(row: SuiteRow) {
  return row.details.filter(detail => detail.headline && detail.verdict === 'flagged').length
}
</script>

<style scoped>
.language-alert {
  margin-bottom: 12px;
}
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
.computing {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 48px 16px;
  color: var(--el-text-color-regular);
  text-align: center;
}
.computing p {
  margin: 0;
  color: var(--el-text-color-secondary);
}
.details-heading {
  margin: 8px 0;
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
