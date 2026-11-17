<template>
  <div class="run-metrics">
    <div class="head">
      <h4>Fairness metrics</h4>
      <div class="actions">
        <el-button size="small" :disabled="!missingRunIds.length" :loading="computing" data-test="compute-missing" @click="computeMissing">
          Compute missing ({{ missingRunIds.length }})
        </el-button>
        <el-button size="small" :disabled="!runs.length || computing" data-test="recompute-all" @click="recomputeAll">
          Recompute all
        </el-button>
        <el-button size="small" :disabled="!rows.length" data-test="export-metrics" @click="exportMetrics">Export metrics CSV</el-button>
        <el-button size="small" data-test="export-overview" @click="exportOverview">Export run overview CSV</el-button>
      </div>
    </div>
    <p class="muted">
      LangFair results with 95% bootstrap CIs. “flagged” = the CI rule of that metric is met (gap CI excludes 0, or
      cross-group − noise CI entirely below 0). No multiple-comparison correction is applied.
    </p>

    <div class="status-row">
      <span v-for="run in runs" :key="run.id" class="status-item">
        {{ runTitle(run) }}:
        <el-tag size="small" :type="tagType(run.id)">{{ statusLabel(run.id) }}</el-tag>
        <span v-if="computedAt(run.id)" class="muted">computed {{ computedAt(run.id) }}</span>
        <span v-if="flagged[run.id]" class="flagged">{{ flagged[run.id] }} flagged</span>
      </span>
    </div>

    <template v-if="rows.length">
      <div class="filters">
        <el-select v-model="suiteFilter" placeholder="All suites" clearable size="small" class="suite">
          <el-option v-for="suite in suites" :key="suite" :label="suite" :value="suite" />
        </el-select>
        <el-checkbox v-model="onlyFlagged" data-test="only-flagged">Only rows flagged in at least one run</el-checkbox>
      </div>
      <el-table :data="visibleRows" size="small" border data-test="metric-matrix">
        <el-table-column label="Suite" prop="suite" width="130" fixed />
        <el-table-column label="Metric" min-width="240" fixed>
          <template #default="{ row }">{{ row.label }}</template>
        </el-table-column>
        <el-table-column v-for="run in loadedRuns" :key="run.id" min-width="190" align="right">
          <template #header>
            <div class="run-head">{{ runTitle(run) }}</div>
            <div class="muted">{{ run.llmSnapshot?.modelName }}</div>
          </template>
          <template #default="{ row }">
            <template v-if="row.cells[String(run.id)]">
              <div :class="{ 'is-flagged': row.cells[String(run.id)].verdict === 'flagged' }">
                {{ format(row.cells[String(run.id)].value) }}
                <el-tag v-if="row.cells[String(run.id)].verdict === 'flagged'" size="small" type="danger" effect="plain">flagged</el-tag>
              </div>
              <div class="muted">{{ row.cells[String(run.id)].ci !== '—' ? row.cells[String(run.id)].ci : '' }}</div>
            </template>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
      </el-table>
    </template>
    <p v-else-if="!loading" class="muted">No computed metrics for the selected runs yet.</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { formatApiError } from '@/services/api'
import { responseApi } from '@/services/responseApi'
import type { LangFairMetricsResult, RunStatus } from '@/types'
import { downloadCsv, toCsv } from '@/utils/csv'
import { flaggedCount, pivotRunMetrics } from '@/utils/experimentMetrics'

const props = defineProps<{ runs: RunStatus[]; evaluationId: string; evaluationName?: string }>()

interface MetricState {
  status: 'none' | 'running' | 'completed' | 'failed' | 'error'
  result: LangFairMetricsResult | null
  error?: string | null
}

const POLL_MS = 4000
const states = ref<Record<number, MetricState>>({})
const loading = ref(false)
const computing = ref(false)
const suiteFilter = ref('')
const onlyFlagged = ref(false)
let pollTimer: ReturnType<typeof setTimeout> | undefined
onBeforeUnmount(() => clearTimeout(pollTimer))

const runTitle = (run: RunStatus) => run.label || `Run #${run.id}`
const loadedRuns = computed(() => props.runs.filter(run => states.value[run.id]?.result))
const missingRunIds = computed(() =>
  props.runs.filter(run => ['none', 'failed', 'error'].includes(states.value[run.id]?.status ?? '')).map(run => run.id),
)
const rows = computed(() =>
  pivotRunMetrics(Object.fromEntries(loadedRuns.value.map(run => [String(run.id), states.value[run.id]?.result]))),
)
const flagged = computed<Record<number, number>>(() =>
  Object.fromEntries(loadedRuns.value.map(run => [run.id, flaggedCount(rows.value, String(run.id))])),
)
const suites = computed(() => [...new Set(rows.value.map(row => row.suite))])
const visibleRows = computed(() =>
  rows.value.filter(row => {
    if (suiteFilter.value && row.suite !== suiteFilter.value) return false
    if (onlyFlagged.value && !Object.values(row.cells).some(cell => cell?.verdict === 'flagged')) return false
    return true
  }),
)
const format = (value: number) => (Math.abs(value) >= 100 ? value.toFixed(1) : value.toFixed(4))

function statusLabel(runId: number) {
  const state = states.value[runId]
  if (!state) return 'loading…'
  return { none: 'not computed', running: 'computing…', completed: 'ready', failed: 'failed', error: 'error' }[state.status]
}
function computedAt(runId: number) {
  const value = states.value[runId]?.result?.computedAt
  return value ? new Date(value).toLocaleString() : ''
}
function tagType(runId: number) {
  const status = states.value[runId]?.status
  return status === 'completed' ? 'success' : status === 'failed' || status === 'error' ? 'danger' : 'info'
}

type Payload = Awaited<ReturnType<typeof responseApi.fetchCachedLangFairMetrics>>
function toState(payload: Payload): MetricState {
  if (payload.status === 'completed' && payload.result) return { status: 'completed', result: payload.result }
  const status = (['running', 'failed'].includes(payload.status as string) ? payload.status : 'none') as MetricState['status']
  return { status, result: null, error: payload.error }
}
function setState(runId: number, state: MetricState) {
  states.value = { ...states.value, [runId]: state }
}

async function fetchState(runId: number) {
  try {
    setState(runId, toState(await responseApi.fetchCachedLangFairMetrics(runId)))
  } catch (e) {
    setState(runId, { status: 'error', result: null, error: formatApiError(e, 'Unable to load metrics.') })
  }
}

async function loadAll() {
  loading.value = true
  // Always read the latest stored computation of every run (never a copy kept in the page).
  await Promise.all(props.runs.map(run => fetchState(run.id)))
  loading.value = false
  schedulePoll()
}

async function computeMissing() {
  await compute(missingRunIds.value)
}

/** Fresh computation for every selected run (the backend never reuses an earlier result). */
async function recomputeAll() {
  await compute(props.runs.map(run => run.id))
}

async function compute(runIds: number[]) {
  computing.value = true
  for (const runId of runIds) {
    try {
      setState(runId, toState(await responseApi.startLangFairMetrics(runId)))
    } catch (e) {
      setState(runId, { status: 'error', result: null, error: formatApiError(e, 'Unable to start metrics.') })
    }
  }
  computing.value = false
  schedulePoll()
}

function schedulePoll() {
  clearTimeout(pollTimer)
  const running = props.runs.filter(run => states.value[run.id]?.status === 'running')
  if (!running.length) return
  pollTimer = setTimeout(async () => {
    await Promise.all(running.map(run => fetchState(run.id)))
    schedulePoll()
  }, POLL_MS)
}

watch(() => props.runs.map(run => run.id).join(','), () => void loadAll(), { immediate: true })

const stamp = () => new Date().toISOString().slice(0, 10)

function exportMetrics() {
  const header = ['run_id', 'run_label', 'evaluation_id', 'provider', 'model', 'population_id', 'computed_at', 'suite',
    'metric_key', 'metric', 'value', 'ci', 'verdict', 'rule']
  const csvRows: (string | number)[][] = []
  for (const run of loadedRuns.value) {
    for (const row of rows.value) {
      const cell = row.cells[String(run.id)]
      if (!cell) continue
      csvRows.push([run.id, run.label ?? '', props.evaluationId, run.llmSnapshot?.provider ?? '',
        run.llmSnapshot?.modelName ?? '', run.promptPopulationId ?? '', states.value[run.id]?.result?.computedAt ?? '',
        row.suite, row.key, row.label,
        cell.value, cell.ci, cell.verdict, cell.rule])
    }
  }
  downloadCsv(`evaluation${props.evaluationId}_run_metrics_${stamp()}.csv`, toCsv(header, csvRows))
}

function exportOverview() {
  const header = ['run_id', 'run_label', 'evaluation_id', 'evaluation_name', 'provider', 'model', 'base_url', 'temperature',
    'generations_per_prompt', 'population_id', 'status', 'total_generations', 'completed_generations',
    'failed_generations', 'failure_rate', 'started_at', 'finished_at', 'metrics_status', 'flagged_metrics']
  const csvRows = props.runs.map(run => {
    const snapshot = run.llmSnapshot
    const attempted = run.completedGenerations + run.failedGenerations
    return [run.id, run.label ?? '', props.evaluationId, props.evaluationName ?? '', snapshot?.provider ?? '',
      snapshot?.modelName ?? '', snapshot?.baseUrl ?? '', snapshot?.temperature ?? '', snapshot?.generationsPerPrompt ?? '',
      run.promptPopulationId ?? '', run.status, run.totalGenerations, run.completedGenerations, run.failedGenerations,
      attempted ? Math.round((run.failedGenerations / attempted) * 10000) / 10000 : 0, run.startedAt ?? '',
      run.finishedAt ?? '', states.value[run.id]?.status ?? '', flagged.value[run.id] ?? '']
  })
  downloadCsv(`evaluation${props.evaluationId}_runs_${stamp()}.csv`, toCsv(header, csvRows))
}
</script>

<style scoped>
.run-metrics {
  margin-bottom: 24px;
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.head h4 {
  margin: 0;
}
.actions,
.filters,
.status-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}
.filters,
.status-row {
  margin-bottom: 12px;
}
.status-item {
  font-size: 13px;
  margin-right: 12px;
}
.suite {
  width: 200px;
}
.muted {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.flagged {
  color: var(--el-color-danger);
  font-size: 12px;
  margin-left: 4px;
}
.is-flagged {
  color: var(--el-color-danger);
  font-weight: 600;
}
.run-head {
  font-weight: 600;
}
</style>
