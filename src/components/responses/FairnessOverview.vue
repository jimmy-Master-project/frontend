<template>
  <div class="fairness-overview">
    <p class="verdict" :class="{ warn: flagged.length }">
      <template v-if="flagged.length">
        <strong>{{ flagged.length }}</strong> 項指標超過閾值
      </template>
      <template v-else>
        沒有指標超過閾值
        <span class="note">沒有閾值的指標請見各 suite 的細部數據。</span>
      </template>
    </p>

    <el-table v-if="flagged.length" :data="flagged" size="small" border class="flagged-table">
      <el-table-column prop="suite" label="Suite" width="130" />
      <el-table-column label="指標" min-width="240">
        <template #default="{ row }">
          <strong>{{ (row as FlaggedRow).label }}</strong>
        </template>
      </el-table-column>
      <el-table-column label="數值" width="110" align="right">
        <template #default="{ row }">{{ formatScore((row as FlaggedRow).value) }}</template>
      </el-table-column>
      <el-table-column prop="ci" label="95% CI" width="170" align="right" />
      <el-table-column prop="rule" label="判定規則" min-width="200" />
    </el-table>

    <table class="suite-table">
      <thead>
        <tr>
          <th>Suite</th>
          <th class="num">超過</th>
          <th class="num">通過</th>
          <th class="num">無閾值</th>
          <th />
        </tr>
      </thead>
      <tbody>
        <tr v-for="suite in suiteSummaries" :key="suite.name" @click="$emit('open-suite', suite.name)">
          <td class="suite-name">{{ suite.name }}</td>
          <td v-if="suite.problem" colspan="3" class="suite-status">{{ suite.problem }}</td>
          <template v-else>
            <td class="num" :class="{ zero: !suite.flagged, flag: suite.flagged }">{{ suite.flagged }}</td>
            <td class="num" :class="{ zero: !suite.pass }">{{ suite.pass }}</td>
            <td class="num" :class="{ zero: !suite.info }">{{ suite.info }}</td>
          </template>
          <td class="open">
            <button type="button" @click.stop="$emit('open-suite', suite.name)">細部數據</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
/**
 * At-a-glance verdict of a LangFair result: which metrics are over their
 * threshold, and per suite how many are over / within / without a threshold.
 * Per-group values and noise baselines are left to the suite details.
 */
import { computed } from 'vue'

import { formatScore, type SuiteRow } from '@/utils/langfairMetrics'

const props = defineProps<{ rows: SuiteRow[] }>()
defineEmits<{ 'open-suite': [name: string] }>()

interface FlaggedRow {
  suite: string
  label: string
  value: number
  ci: string
  rule: string
}

const flagged = computed<FlaggedRow[]>(() =>
  props.rows.flatMap(row =>
    row.details
      .filter(detail => detail.headline && detail.verdict === 'flagged')
      .map(detail => ({ suite: row.name, label: detail.label, value: detail.value, ci: detail.ci, rule: detail.rule })),
  ),
)

const suiteSummaries = computed(() =>
  props.rows.map(row => {
    const headline = row.details.filter(detail => detail.headline)
    return {
      name: row.name,
      // A suite that was not computed (non-English, missing input) has no verdict.
      problem: row.status && row.status !== 'ok' ? row.status : '',
      flagged: headline.filter(detail => detail.verdict === 'flagged').length,
      pass: headline.filter(detail => detail.verdict === 'pass').length,
      info: headline.filter(detail => detail.verdict === 'info').length,
    }
  }),
)
</script>

<style scoped>
.verdict { margin: 0 0 12px; font-size: 14px; color: var(--el-text-color-primary); }
.verdict.warn strong { color: var(--el-color-warning-dark-2); }
.verdict .note { margin-left: 8px; font-size: 12px; color: var(--el-text-color-secondary); }
.flagged-table { margin-bottom: 16px; }

.suite-table { width: 100%; max-width: 560px; margin-bottom: 16px; border-collapse: collapse; font-size: 13px; }
.suite-table th { padding: 6px 10px; border-bottom: 1px solid var(--el-border-color); color: var(--el-text-color-secondary); font-weight: 400; text-align: left; }
.suite-table td { padding: 7px 10px; border-bottom: 1px solid var(--el-border-color-lighter); color: var(--el-text-color-regular); }
.suite-table tbody tr { cursor: pointer; }
.suite-table tbody tr:hover td { background: var(--el-fill-color-light); }
.suite-table .num { width: 64px; text-align: right; font-variant-numeric: tabular-nums; }
.suite-table .zero { color: var(--el-text-color-placeholder); }
.suite-table .flag { color: var(--el-color-warning-dark-2); font-weight: 600; }
.suite-name { color: var(--el-text-color-primary); font-family: var(--el-font-family-monospace, ui-monospace, monospace); }
.suite-status { color: var(--el-text-color-secondary); }
.open { width: 1%; text-align: right; white-space: nowrap; }
.open button { padding: 0; border: 0; background: none; color: var(--el-color-primary); font: inherit; font-size: 12px; cursor: pointer; }
.open button:hover { text-decoration: underline; }
</style>
