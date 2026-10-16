<script setup lang="ts">
/**
 * Run history of ONE evaluation: every run of the (reusable) flow is kept
 * with the Target LLM settings it used, so outputs can be compared side by
 * side across models / configs. Runs can be renamed and deleted here.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'

import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import RunExportMenu from '@/components/run/RunExportMenu.vue'
import { formatApiError, isCanceledError } from '@/services/api'
import { evaluationApi } from '@/services/evaluationApi'
import { runApi } from '@/services/runApi'
import type { Evaluation, RunResponseRecord, RunStatus } from '@/types'

const props = defineProps<{ evaluationId: string }>()
const router = useRouter()

const COMPARE_PAGE_SIZE = 20
const ACTIVE = ['pending', 'running']
const ACTIVE_POLL_MS = 5000

const evaluation = ref<Evaluation | null>(null)
const runs = ref<RunStatus[]>([])
const loading = ref(false)
const loadError = ref('')
const selected = ref<RunStatus[]>([])

const pendingDelete = ref<RunStatus | null>(null)
const deleting = ref(false)

// ------------------------------------------------------------------ loading
let controller = new AbortController()
let pollTimer: ReturnType<typeof setTimeout> | undefined
onBeforeUnmount(() => {
  controller.abort()
  clearTimeout(pollTimer)
})

async function loadRuns(quiet = false) {
  const evaluationId = props.evaluationId
  if (!quiet) loading.value = true
  loadError.value = ''
  clearTimeout(pollTimer)
  try {
    const result = await runApi.listRuns(evaluationId, controller.signal)
    if (evaluationId !== props.evaluationId) return
    runs.value = result
    // Keep the selection on refreshed objects (el-table compares by row-key).
    const ids = new Set(selected.value.map(run => run.id))
    selected.value = result.filter(run => ids.has(run.id))
    if (result.some(run => ACTIVE.includes(run.status))) {
      pollTimer = setTimeout(() => void loadRuns(true), ACTIVE_POLL_MS)
    }
  } catch (e) {
    if (!isCanceledError(e)) loadError.value = formatApiError(e, 'Unable to load the run history.')
  } finally {
    loading.value = false
  }
}

watch(
  () => props.evaluationId,
  async evaluationId => {
    controller.abort()
    controller = new AbortController()
    runs.value = []
    selected.value = []
    compared.value = []
    responseCache.clear()
    evaluation.value = null
    void evaluationApi.get(evaluationId).then(
      item => evaluationId === props.evaluationId && (evaluation.value = item),
      () => undefined,
    )
    await loadRuns()
  },
)
onMounted(() => {
  void evaluationApi.get(props.evaluationId).then(item => (evaluation.value = item), () => undefined)
  void loadRuns()
})

// ------------------------------------------------------------- formatting
function modelLabel(run: RunStatus) {
  const snapshot = run.llmSnapshot
  if (snapshot?.modelName) return snapshot.modelName
  if (snapshot?.external || run.external) return 'External bot'
  return 'Unknown (before history)'
}
function settingsLabel(run: RunStatus) {
  const s = run.llmSnapshot
  if (!s?.modelName) return '—'
  return `temp ${s.temperature} · top-p ${s.topP} · max ${s.maxTokens} · ×${s.generationsPerPrompt}`
}
function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : '—'
}
function duration(run: RunStatus) {
  if (!run.startedAt || !run.finishedAt) return ''
  const seconds = Math.round((Date.parse(run.finishedAt) - Date.parse(run.startedAt)) / 1000)
  return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`
}
function statusType(status: RunStatus['status']) {
  return status === 'completed' ? 'success' : status === 'failed' ? 'danger' : 'warning'
}
const runTitle = (run: RunStatus) => run.label || `Run #${run.id}`

// --------------------------------------------------------- rename / delete
async function renameRun(run: RunStatus) {
  let label: string
  try {
    const result = await ElMessageBox.prompt('Run name', `Rename run #${run.id}`, {
      inputValue: run.label || `${modelLabel(run)}`,
    })
    label = result.value.trim()
  } catch {
    return
  }
  try {
    const updated = await runApi.updateRun(run.id, { label })
    runs.value = runs.value.map(item => (item.id === run.id ? { ...item, label: updated.label } : item))
    compared.value = compared.value.map(item => (item.id === run.id ? { ...item, label: updated.label } : item))
  } catch (e) {
    ElMessage.error(formatApiError(e, 'Unable to rename the run.'))
  }
}
async function confirmDelete() {
  const run = pendingDelete.value
  if (!run) return
  deleting.value = true
  try {
    await runApi.deleteRun(run.id)
    ElMessage.success(`Run #${run.id} and its responses were deleted.`)
    responseCache.delete(run.id)
    compared.value = compared.value.filter(item => item.id !== run.id)
    pendingDelete.value = null
    await loadRuns(true)
  } catch (e) {
    ElMessage.error(formatApiError(e, 'Unable to delete the run.'))
  } finally {
    deleting.value = false
  }
}
const deleteDialogOpen = computed({
  get: () => pendingDelete.value !== null,
  set: open => {
    if (!open) pendingDelete.value = null
  },
})

// ---------------------------------------------------------------- compare
const compared = ref<RunStatus[]>([])
const comparing = ref(false)
const responseCache = new Map<number, RunResponseRecord[]>()
const comparedResponses = ref<Record<number, RunResponseRecord[]>>({})
const keyword = ref('')
const categoryFilter = ref('')
const onlyDifferent = ref(false)
const comparePage = ref(1)

async function compareSelected() {
  const targets = [...selected.value].sort((a, b) => a.id - b.id)
  if (!targets.length) return
  comparing.value = true
  try {
    const results = await Promise.all(
      targets.map(async run => {
        // Finished runs never change; active ones are always refetched.
        const cached = !ACTIVE.includes(run.status) ? responseCache.get(run.id) : undefined
        const records = cached ?? (await runApi.fetchRunResponses(run.id, controller.signal))
        if (!ACTIVE.includes(run.status)) responseCache.set(run.id, records)
        return [run.id, records] as const
      }),
    )
    comparedResponses.value = Object.fromEntries(results)
    compared.value = targets
    comparePage.value = 1
  } catch (e) {
    if (!isCanceledError(e)) ElMessage.error(formatApiError(e, 'Unable to load run responses.'))
  } finally {
    comparing.value = false
  }
}

interface CompareRow {
  key: string
  promptText: string
  category: string
  generationIndex: number
  cells: Record<number, RunResponseRecord | undefined>
}

/** Prompts are matched by text + generation so runs on regenerated populations still line up. */
const compareRows = computed<CompareRow[]>(() => {
  const rows = new Map<string, CompareRow>()
  for (const run of compared.value) {
    for (const record of comparedResponses.value[run.id] ?? []) {
      const key = `${record.prompt.text}\u0000${record.generationIndex}`
      let row = rows.get(key)
      if (!row) {
        row = { key, promptText: record.prompt.text, category: record.prompt.category, generationIndex: record.generationIndex, cells: {} }
        rows.set(key, row)
      }
      row.cells[run.id] = record
    }
  }
  return [...rows.values()]
})
const categories = computed(() => [...new Set(compareRows.value.map(row => row.category).filter(Boolean))].sort())
const filteredRows = computed(() => {
  const term = keyword.value.trim().toLowerCase()
  return compareRows.value.filter(row => {
    if (categoryFilter.value && row.category !== categoryFilter.value) return false
    const texts = compared.value.map(run => row.cells[run.id]?.responseText ?? '')
    if (onlyDifferent.value && new Set(texts.map(text => text.trim())).size < 2) return false
    if (!term) return true
    return row.promptText.toLowerCase().includes(term) || texts.some(text => text.toLowerCase().includes(term))
  })
})
const pagedRows = computed(() =>
  filteredRows.value.slice((comparePage.value - 1) * COMPARE_PAGE_SIZE, comparePage.value * COMPARE_PAGE_SIZE),
)
watch([keyword, categoryFilter, onlyDifferent], () => (comparePage.value = 1))

function average(values: Array<number | null>) {
  const numbers = values.filter((value): value is number => typeof value === 'number')
  return numbers.length ? Math.round(numbers.reduce((sum, value) => sum + value, 0) / numbers.length) : 0
}
const runStats = computed(() =>
  compared.value.map(run => {
    const records = comparedResponses.value[run.id] ?? []
    const ok = records.filter(record => !record.error)
    return {
      run,
      total: records.length,
      failed: records.length - ok.length,
      avgLatency: average(ok.map(record => record.latencyMs)),
      avgOutputTokens: average(ok.map(record => record.outputTokens)),
      avgChars: average(ok.map(record => record.responseText.length)),
    }
  }),
)
</script>

<template>
  <div class="history-view">
    <div class="page-header">
      <div>
        <div class="crumb">
          <router-link to="/">Projects</router-link> /
          <span>{{ evaluation?.name || `Evaluation #${evaluationId}` }}</span> /
          <strong>Run history</strong>
        </div>
        <h2>Run history</h2>
        <p class="hint">
          Every run of this evaluation's flow is kept with the Target LLM it used. Select runs and compare their outputs.
        </p>
      </div>
      <div class="header-actions">
        <el-button @click="router.push({ name: 'flow-editor', params: { evaluationId } })">Open flow</el-button>
        <el-button @click="router.push(`/evaluations/${evaluationId}/llm`)">Change Target LLM &amp; run again</el-button>
        <el-button :loading="loading" @click="loadRuns()">Refresh</el-button>
      </div>
    </div>

    <el-alert v-if="loadError" type="error" :title="loadError" :closable="false" class="block" />

    <el-table
      v-loading="loading"
      :data="runs"
      row-key="id"
      empty-text="No runs yet. Run the flow to record results here."
      class="block"
      @selection-change="(rows: RunStatus[]) => (selected = rows)"
    >
      <el-table-column type="selection" width="44" :reserve-selection="true" />
      <el-table-column label="Run" min-width="180">
        <template #default="{ row }">
          <div class="run-name">
            <b>{{ runTitle(row as RunStatus) }}</b>
            <small>#{{ row.id }}<template v-if="row.promptPopulationId"> · population {{ row.promptPopulationId }}</template></small>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="Target LLM" min-width="200">
        <template #default="{ row }">
          <div class="run-name">
            <b>{{ modelLabel(row as RunStatus) }}</b>
            <small>{{ row.llmSnapshot?.provider || '' }} {{ settingsLabel(row as RunStatus) }}</small>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="Status" width="110">
        <template #default="{ row }">
          <el-tag :type="statusType(row.status)" size="small">{{ row.status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="Generations" width="130" align="right">
        <template #default="{ row }">
          {{ row.completedGenerations }} / {{ row.totalGenerations }}
          <div v-if="row.failedGenerations" class="failed">{{ row.failedGenerations }} failed</div>
        </template>
      </el-table-column>
      <el-table-column label="Started" width="190">
        <template #default="{ row }">
          {{ formatDate(row.startedAt) }}
          <div v-if="duration(row as RunStatus)" class="muted">{{ duration(row as RunStatus) }}</div>
        </template>
      </el-table-column>
      <el-table-column label="" width="300" align="right">
        <template #default="{ row }">
          <el-button
            text
            size="small"
            type="primary"
            @click="router.push({ path: `/evaluations/${evaluationId}/responses`, query: { runId: String((row as RunStatus).id) } })"
          >
            Results
          </el-button>
          <RunExportMenu class="row-export" :run-id="(row as RunStatus).id" size="small" text />
          <el-button text size="small" @click="renameRun(row as RunStatus)">Rename</el-button>
          <el-button text size="small" type="danger" :disabled="ACTIVE.includes(row.status)" @click="pendingDelete = row as RunStatus">
            Delete
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="compare-bar">
      <span class="muted">{{ selected.length }} run(s) selected</span>
      <el-button type="primary" :disabled="!selected.length" :loading="comparing" @click="compareSelected">
        {{ selected.length > 1 ? `Compare ${selected.length} runs` : 'View outputs' }}
      </el-button>
    </div>

    <section v-if="compared.length" class="compare block">
      <h3>Comparison</h3>
      <el-table :data="runStats" size="small" class="block">
        <el-table-column label="Run" min-width="180">
          <template #default="{ row }">{{ runTitle(row.run) }} <span class="muted">#{{ row.run.id }}</span></template>
        </el-table-column>
        <el-table-column label="Target LLM" min-width="160">
          <template #default="{ row }">{{ modelLabel(row.run) }}</template>
        </el-table-column>
        <el-table-column prop="total" label="Responses" align="right" width="100" />
        <el-table-column prop="failed" label="Failed" align="right" width="80" />
        <el-table-column label="Avg latency" align="right" width="110">
          <template #default="{ row }">{{ row.avgLatency }} ms</template>
        </el-table-column>
        <el-table-column prop="avgOutputTokens" label="Avg out tokens" align="right" width="130" />
        <el-table-column prop="avgChars" label="Avg chars" align="right" width="100" />
      </el-table>

      <div class="filters">
        <el-input v-model="keyword" placeholder="Search prompts or outputs…" clearable class="search" />
        <el-select v-model="categoryFilter" placeholder="Category" clearable class="category">
          <el-option v-for="category in categories" :key="category" :label="category" :value="category" />
        </el-select>
        <el-checkbox v-if="compared.length > 1" v-model="onlyDifferent">Only rows whose outputs differ</el-checkbox>
        <span class="muted">{{ filteredRows.length }} row(s)</span>
      </div>

      <div class="compare-grid" :style="{ '--columns': compared.length }">
        <div class="grid-head prompt-col">Prompt</div>
        <div v-for="run in compared" :key="run.id" class="grid-head">
          {{ runTitle(run) }}<small>{{ modelLabel(run) }}</small>
        </div>
        <template v-for="row in pagedRows" :key="row.key">
          <div class="prompt-col cell">
            <p>{{ row.promptText }}</p>
            <small>{{ row.category || 'uncategorized' }} · generation {{ row.generationIndex }}</small>
          </div>
          <div v-for="run in compared" :key="run.id" class="cell">
            <template v-if="row.cells[run.id]">
              <p v-if="row.cells[run.id]!.error" class="failed">{{ row.cells[run.id]!.error }}</p>
              <p v-else>{{ row.cells[run.id]!.responseText }}</p>
              <small>{{ row.cells[run.id]!.outputTokens ?? 0 }} tokens · {{ row.cells[run.id]!.latencyMs ?? 0 }} ms</small>
            </template>
            <p v-else class="muted">No output for this prompt.</p>
          </div>
        </template>
      </div>
      <div v-if="!filteredRows.length" class="muted empty">No rows match the filters.</div>
      <el-pagination
        v-if="filteredRows.length > COMPARE_PAGE_SIZE"
        v-model:current-page="comparePage"
        :page-size="COMPARE_PAGE_SIZE"
        :total="filteredRows.length"
        layout="prev, pager, next"
        class="pager"
      />
    </section>

    <ConfirmDialog
      v-model="deleteDialogOpen"
      title="Delete this run?"
      :message="`Run #${pendingDelete?.id} and all of its responses and cached metrics will be permanently deleted.`"
      confirm-text="Delete run"
      :loading="deleting"
      danger
      @confirm="confirmDelete"
    />
  </div>
</template>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 16px; }
.page-header h2 { margin: 6px 0 4px; }
.crumb { font-size: 12px; color: #7b8490; }
.crumb a { color: var(--el-color-primary); text-decoration: none; }
.hint { margin: 0; font-size: 13px; color: #66717e; }
.header-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.header-actions .el-button + .el-button { margin-left: 0; }
.row-export { margin: 0 12px; vertical-align: middle; }
.block { margin-bottom: 16px; }
.run-name { display: flex; flex-direction: column; gap: 2px; }
.run-name small, .muted { color: #8a949f; font-size: 12px; }
.failed { color: var(--el-color-danger); font-size: 12px; }
.compare-bar { display: flex; justify-content: flex-end; align-items: center; gap: 12px; margin-bottom: 24px; }
.compare h3 { margin: 0 0 12px; }
.filters { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.filters .search { max-width: 300px; }
.filters .category { width: 180px; }
.compare-grid { display: grid; grid-template-columns: minmax(200px, 1fr) repeat(var(--columns), minmax(220px, 1.4fr)); border: 1px solid var(--el-border-color-light); border-radius: 6px; overflow-x: auto; background: #fff; }
.grid-head { position: sticky; top: 0; padding: 10px 12px; background: #f5f7fa; border-bottom: 1px solid var(--el-border-color-light); font-size: 13px; font-weight: 600; }
.grid-head small { display: block; font-weight: 400; color: #8a949f; }
.cell { padding: 10px 12px; border-bottom: 1px solid #eef0f3; border-left: 1px solid #eef0f3; min-width: 0; }
.prompt-col { border-left: 0; background: #fbfcfd; }
.cell p { margin: 0 0 6px; max-height: 220px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 13px; line-height: 1.5; }
.cell small { color: #8a949f; font-size: 11px; }
.empty { padding: 16px 0; }
.pager { margin-top: 12px; justify-content: center; }
</style>
