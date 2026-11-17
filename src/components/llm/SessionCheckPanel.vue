<template>
  <el-card shadow="never" class="session-check">
    <template #header>
      <div class="header">
        <div>
          <div class="title">Session isolation check</div>
          <div class="subtitle">
            Canary test with the <b>saved</b> settings: one request tells the target a unique booking reference and
            name, a separate request asks for them back. An isolated target cannot answer. Run this before a formal
            experiment and record the result in the method chapter.
          </div>
        </div>
        <el-tag v-if="results.length && !running" :type="leakCount ? 'danger' : 'success'" data-test="session-verdict">
          {{ leakCount ? `${leakCount} / ${results.length} leaked` : `${results.length} / ${results.length} isolated` }}
        </el-tag>
      </div>
    </template>

    <div class="controls">
      <span>Trials</span>
      <el-input-number v-model="trials" :min="1" :max="10" :disabled="running" size="small" />
      <el-button type="primary" :loading="running" data-test="session-run" @click="run">
        {{ running ? `Trial ${results.length + 1} / ${trials}…` : 'Run check' }}
      </el-button>
      <el-button v-if="running" @click="stop">Stop</el-button>
      <el-button v-if="results.length && !running" text data-test="session-export" @click="exportCsv">Export CSV</el-button>
    </div>

    <el-alert v-if="error" type="error" :title="error" show-icon :closable="false" class="block" />

    <el-table v-if="results.length" :data="results" size="small" class="block" data-test="session-table">
      <el-table-column type="index" label="#" width="44" />
      <el-table-column label="Planted" width="170">
        <template #default="{ row }">{{ row.code }} · {{ row.name }}</template>
      </el-table-column>
      <el-table-column label="Answer to “what is my booking reference?”" min-width="320">
        <template #default="{ row }"><span class="answer">{{ row.probeResponse }}</span></template>
      </el-table-column>
      <el-table-column label="Result" width="110">
        <template #default="{ row }">
          <el-tag :type="row.leaked ? 'danger' : 'success'" size="small">{{ row.leaked ? 'Leaked' : 'Isolated' }}</el-tag>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { formatApiError } from '@/services/api'
import { llmConfigApi, type SessionCheckTrial } from '@/services/llmConfigApi'
import { downloadCsv, toCsv } from '@/utils/csv'

const props = defineProps<{ evaluationId: string }>()

const trials = ref(5)
const running = ref(false)
const error = ref('')
const results = ref<SessionCheckTrial[]>([])
const leakCount = computed(() => results.value.filter(item => item.leaked).length)
let stopped = false

async function run() {
  running.value = true
  stopped = false
  error.value = ''
  results.value = []
  try {
    // One trial per request so a slow web chatbot never hits one huge request.
    for (let index = 0; index < trials.value && !stopped; index++) {
      results.value = [...results.value, await llmConfigApi.sessionCheck(props.evaluationId)]
    }
  } catch (e) {
    error.value = formatApiError(e, 'Session check failed.')
  } finally {
    running.value = false
  }
}

function stop() {
  stopped = true
}

function exportCsv() {
  const header = ['trial', 'provider', 'model', 'code', 'name', 'plant_prompt', 'plant_response',
    'probe_prompt', 'probe_response', 'leaked_code', 'leaked_name', 'leaked']
  const rows = results.value.map((item, index) => [index + 1, item.provider, item.modelName, item.code, item.name,
    item.plantPrompt, item.plantResponse, item.probePrompt, item.probeResponse, item.leakedCode, item.leakedName, item.leaked])
  downloadCsv(`session_check_evaluation${props.evaluationId}.csv`, toCsv(header, rows))
}

watch(() => props.evaluationId, () => {
  stopped = true
  results.value = []
  error.value = ''
})
</script>

<style scoped>
.session-check {
  margin-top: 16px;
}
.header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}
.title {
  font-weight: 600;
}
.subtitle {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}
.controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.block {
  margin-top: 12px;
}
.answer {
  white-space: pre-wrap;
}
</style>
