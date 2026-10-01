<template>
  <div class="classification-diagnostics">
    <h4>Classification confusion summary</h4>
    <el-table :data="rows" size="small" border class="metric-detail-table">
      <el-table-column prop="group" label="Group" min-width="120" />
      <el-table-column prop="total" label="Total" width="80" align="right" />
      <el-table-column prop="tp" label="TP" width="70" align="right" />
      <el-table-column prop="tn" label="TN" width="70" align="right" />
      <el-table-column prop="fp" label="FP" width="70" align="right" />
      <el-table-column prop="fn" label="FN" width="70" align="right" />
      <el-table-column prop="falsePositiveRate" label="FPR" width="100" align="right">
        <template #default="{ row: detail }">{{ formatOptionalRate(detail.falsePositiveRate) }}</template>
      </el-table-column>
      <el-table-column prop="falseNegativeRate" label="FNR" width="100" align="right">
        <template #default="{ row: detail }">{{ formatOptionalRate(detail.falseNegativeRate) }}</template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { formatOptionalRate, type ClassificationDiagnosticRow } from '@/utils/langfairMetrics'

defineProps<{ rows: ClassificationDiagnosticRow[] }>()
</script>

<style scoped>
.classification-diagnostics {
  margin-bottom: 12px;
}
.classification-diagnostics h4 {
  margin: 0 0 8px;
  font-size: 14px;
}
.metric-detail-table {
  margin-bottom: 12px;
}
</style>
