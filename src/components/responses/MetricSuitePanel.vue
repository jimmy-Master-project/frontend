<template>
  <div class="metric-suite-panel">
    <el-alert
      v-if="row.status && row.status !== 'ok'"
      :type="row.status === 'unsupported_language' ? 'error' : row.status === 'missing_input' || row.status === 'insufficient_input' ? 'warning' : 'info'"
      :title="getSuiteMessage(row.value)"
      show-icon
      :closable="false"
      class="state-alert"
    />
    <el-alert
      v-if="row.languageCoverageWarning"
      type="warning"
      :title="row.languageCoverageWarning"
      show-icon
      :closable="false"
      class="state-alert"
    />
    <el-alert
      v-if="scoringUnit"
      type="info"
:title="scoringNote"
      show-icon
      :closable="false"
      class="state-alert"
    />
    <ClassificationConfusionTable v-if="row.classificationDiagnostics.length" :rows="row.classificationDiagnostics" />

    <el-table v-if="row.details.length" :data="row.details" size="small" border class="metric-detail-table">
      <el-table-column prop="label" label="Metric / 細項" min-width="220">
        <template #default="{ row: detail }">
          <strong>{{ detail.label }}</strong>
          <div class="path-text">{{ detail.path }}</div>
        </template>
      </el-table-column>
      <el-table-column prop="value" label="Score / 分數" width="140" align="right">
        <template #default="{ row: detail }">
          <span class="score-value">{{ formatScore(detail.value) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="判定" width="150">
        <template #default="{ row: detail }">
          <el-tag size="small" :type="detail.verdict === 'flagged' ? 'warning' : detail.verdict === 'pass' ? 'success' : 'info'">
            {{ detail.verdict === 'flagged' ? '超過閾值' : detail.verdict === 'pass' ? '通過' : '無閾值' }}
          </el-tag>
          <div class="path-text">{{ detail.rule }}</div>
        </template>
      </el-table-column>
      <el-table-column prop="ci" label="95% CI" width="170" align="right" />
      <el-table-column prop="threshold" label="Threshold / 閾值" width="150" />
      <el-table-column prop="calculation" label="Calculation / 計算方式" min-width="260" />
      <el-table-column prop="direction" label="Fairness direction / 公平方向" min-width="180" />
      <el-table-column prop="meaning" label="Meaning / 分數含義" min-width="260" />
    </el-table>
    <el-empty v-if="!row.details.length && !row.classificationDiagnostics.length" description="No numeric metric scores were returned for this suite" :image-size="60" />

    <el-collapse class="raw-collapse">
      <el-collapse-item title="Raw LangFair output" :name="`${row.name}-raw`">
        <pre class="json-block">{{ stringify(row.value) }}</pre>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<script setup lang="ts">
import ClassificationConfusionTable from '@/components/responses/ClassificationConfusionTable.vue'
import { computed } from 'vue'

import { formatScore, getSuiteMessage, stringify, type SuiteRow } from '@/utils/langfairMetrics'

const props = defineProps<{ row: SuiteRow }>()
const scoringUnit = computed(() => {
  const value = props.row.value as { scoringUnit?: unknown } | null
  return typeof value?.scoringUnit === 'string' ? value.scoringUnit : ''
})
// The classifiers read at most 512 tokens, so long responses are scored in parts.
const scoringNote = computed(() =>
  scoringUnit.value.startsWith('chunk')
    ? '分類器分段判斷：每篇回應切成數段（每段為完整句子、最多 480 tokens），每篇的分數 = 各段中的最高分，整篇都會被讀到。'
    : '分類器逐句判斷：每篇回應的分數 = 所有句子中的最高分，整篇都會被讀到。',
)
</script>

<style scoped>
.state-alert {
  margin-bottom: 12px;
}
.metric-detail-table {
  margin-bottom: 12px;
}
.path-text {
  margin-top: 2px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-weight: 400;
}
.score-value {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}
.raw-collapse {
  margin-top: 12px;
}
.json-block {
  margin: 0;
  padding: 12px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
  overflow: auto;
  white-space: pre-wrap;
}
</style>
