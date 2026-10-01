<template>
  <div class="metric-suite-panel">
    <el-alert
      v-if="row.status && row.status !== 'ok'"
      :type="row.status === 'missing_input' || row.status === 'insufficient_input' ? 'warning' : 'info'"
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
    <ClassificationConfusionTable v-if="row.classificationDiagnostics.length" :rows="row.classificationDiagnostics" />

    <el-table v-else-if="row.details.length" :data="row.details" size="small" border class="metric-detail-table">
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
      <el-table-column prop="threshold" label="Threshold / 閾值" width="150" />
      <el-table-column prop="calculation" label="Calculation / 計算方式" min-width="260" />
      <el-table-column prop="direction" label="Fairness direction / 公平方向" min-width="180" />
      <el-table-column prop="meaning" label="Meaning / 分數含義" min-width="260" />
    </el-table>
    <el-empty v-else description="No numeric metric scores were returned for this suite" :image-size="60" />

    <el-collapse class="raw-collapse">
      <el-collapse-item title="Raw LangFair output" :name="`${row.name}-raw`">
        <pre class="json-block">{{ stringify(row.value) }}</pre>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<script setup lang="ts">
import ClassificationConfusionTable from '@/components/responses/ClassificationConfusionTable.vue'
import { formatScore, getSuiteMessage, stringify, type SuiteRow } from '@/utils/langfairMetrics'

defineProps<{ row: SuiteRow }>()
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
