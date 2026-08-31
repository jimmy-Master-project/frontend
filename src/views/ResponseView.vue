<template>
  <div class="response-view">
    <EvaluationStepper :active="4" />
    <h2>Evaluation Results</h2>

    <div class="response-summary">
      <div class="summary-item">
        <span class="label">Model</span><span class="value">{{ responsesStore.model }}</span>
      </div>
      <div class="summary-item">
        <span class="label">Prompt Population</span><span class="value">{{ responsesStore.promptCount }}</span>
      </div>
      <div class="summary-item">
        <span class="label">Total Responses</span><span class="value">{{ responsesStore.total }}</span>
      </div>
    </div>

    <div class="result-actions">
      <el-button type="primary" :disabled="!responsesStore.runId" @click="router.push(`/evaluations/${evaluationId}/fairness-metrics`)">
        View Fairness Metrics
      </el-button>
    </div>

    <div class="toolbar">
      <el-input
        v-model="keyword"
        placeholder="Search prompts or responses..."
        clearable
        style="max-width: 320px"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      />
      <el-select
        v-model="categoryFilter"
        placeholder="Category"
        clearable
        style="width: 180px"
        @change="handleFilterChange"
      >
        <el-option v-for="cat in availableCategories" :key="cat" :label="cat" :value="cat" />
      </el-select>
      <el-select
        v-model="generationFilter"
        placeholder="Generation Index"
        clearable
        style="width: 180px"
        @change="handleFilterChange"
      >
        <el-option v-for="n in maxGenerationIndex" :key="n" :label="`Generation ${n}`" :value="n" />
      </el-select>
      <el-radio-group v-model="viewMode">
        <el-radio-button label="table">Table</el-radio-button>
        <el-radio-button label="grouped">Grouped</el-radio-button>
      </el-radio-group>
    </div>

    <LoadingState v-if="responsesStore.loading" text="Loading responses..." />
    <ErrorState v-else-if="responsesStore.error" :message="responsesStore.error" @retry="load" />
    <template v-else>
      <ResponseTable v-if="viewMode === 'table'" :responses="responsesStore.responses" @select="openDetail" />
      <PromptResponseGroup v-else :responses="responsesStore.responses" />

      <el-pagination
        v-if="responsesStore.total > responsesStore.pageSize"
        class="pagination"
        layout="prev, pager, next"
        :current-page="responsesStore.currentPage"
        :page-size="responsesStore.pageSize"
        :total="responsesStore.total"
        @current-change="handlePageChange"
      />
    </template>

    <ResponseDetailDrawer v-model="detailVisible" :item="selectedResponse" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import EvaluationStepper from '@/components/common/EvaluationStepper.vue'
import ErrorState from '@/components/common/ErrorState.vue'
import LoadingState from '@/components/common/LoadingState.vue'
import PromptResponseGroup from '@/components/responses/PromptResponseGroup.vue'
import ResponseDetailDrawer from '@/components/responses/ResponseDetailDrawer.vue'
import ResponseTable from '@/components/responses/ResponseTable.vue'
import { useResponsesStore } from '@/stores/responses'
import type { ResponseItem } from '@/types'

const route = useRoute()
const router = useRouter()
const evaluationId = computed(() => route.params.evaluationId as string)

const responsesStore = useResponsesStore()

const keyword = ref('')
const categoryFilter = ref<string | null>(null)
const generationFilter = ref<number | null>(null)
const viewMode = ref<'table' | 'grouped'>('table')

const detailVisible = ref(false)
const selectedResponse = ref<ResponseItem | null>(null)

const availableCategories = computed(() => {
  const set = new Set(responsesStore.responses.map(r => r.promptCategory).filter(Boolean))
  return Array.from(set)
})

const maxGenerationIndex = computed(() => {
  return Math.max(1, ...responsesStore.responses.map(r => r.generationIndex))
})

async function load() {
  try {
    await responsesStore.fetchResponses(evaluationId.value)
  } catch {
    // Store state already contains the user-facing error.
  }
}

onMounted(load)

function handleSearch() {
  responsesStore.search(evaluationId.value, keyword.value)
}

function handleFilterChange() {
  responsesStore.setFilter({ category: categoryFilter.value, generationIndex: generationFilter.value })
  load()
}

function handlePageChange(page: number) {
  responsesStore.setPage(page)
  load()
}

function openDetail(item: ResponseItem) {
  selectedResponse.value = item
  detailVisible.value = true
}
</script>

<style scoped>
.response-summary {
  display: flex;
  gap: 40px;
  margin-bottom: 20px;
}
.summary-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.summary-item .label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.summary-item .value {
  font-size: 16px;
  font-weight: 600;
}
.result-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
}
.toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
.pagination {
  margin-top: 20px;
  justify-content: center;
}
</style>
