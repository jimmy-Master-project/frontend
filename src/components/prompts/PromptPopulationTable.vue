<template>
  <div class="prompt-population-table">
    <div class="summary-panel">
      <h3>Population Summary</h3>
      <div class="stats-bar">
        <div class="stat-block">
          <span class="stat-label">Prompts</span>
          <span class="stat-value">{{ prompts.length }}</span>
        </div>
        <div class="stat-block">
          <span class="stat-label">Persona-based</span>
          <span class="stat-value">{{ population?.personaBased ? 'Yes' : 'No' }}</span>
        </div>
        <div v-if="population?.personaBased" class="stat-block">
          <span class="stat-label">Attributes</span>
          <span class="stat-value">{{ population.personaAttributes.length }}</span>
        </div>
        <div v-if="population?.personaBased" class="stat-block">
          <span class="stat-label">Stratified by</span>
          <span class="stat-value">{{ population.stratifiedBy || 'None' }}</span>
        </div>
        <div v-if="population?.personaBased" class="stat-block">
          <span class="stat-label">Seed</span>
          <span class="stat-value">{{ population.seed ?? '—' }}</span>
        </div>
        <div v-if="counterfactualPairs.length" class="stat-block">
          <span class="stat-label">Counterfactual pairs</span>
          <span class="stat-value">{{ counterfactualPairs.length }}</span>
        </div>
      </div>
      <div v-if="categoryEntries.length" class="category-stats">
        <div v-for="[category, count] in categoryEntries" :key="category" class="category-stat">
          <span class="category-name">{{ category }}</span>
          <span class="category-count">{{ count }}</span>
        </div>
      </div>
    </div>

    <el-card v-if="counterfactualPairs.length" shadow="never" class="pair-preview">
      <template #header>Counterfactual Pair Preview</template>
      <el-table :data="counterfactualPairs" size="small" style="width: 100%">
        <el-table-column prop="pairId" label="Pair ID" width="100" />
        <el-table-column label="Original" min-width="220">
          <template #default="{ row }">
            <el-tag size="small">{{ row.original?.fairness?.group }}</el-tag>
            <p>{{ truncate(row.original?.text || '', 100) }}</p>
          </template>
        </el-table-column>
        <el-table-column label="Counterfactual" min-width="220">
          <template #default="{ row }">
            <el-tag size="small" type="warning">{{ row.counterfactual?.fairness?.group }}</el-tag>
            <p>{{ truncate(row.counterfactual?.text || '', 100) }}</p>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <div class="table-toolbar">
      <span v-if="locked" class="locked-hint">Prompts are locked while the population is generating.</span>
      <el-button :disabled="locked" @click="$emit('add')">+ Add Prompt</el-button>
    </div>

    <el-table
      :data="prompts"
      style="width: 100%"
      empty-text="No prompts yet."
      @row-click="(row: Prompt) => $emit('view', row)"
    >
      <el-table-column label="#" width="70">
        <template #default="{ $index }">{{ $index + 1 }}</template>
      </el-table-column>
      <el-table-column type="expand" width="44">
        <template #default="{ row }">
          <div class="expanded-prompt">
            <div v-if="row.fairness?.pairId" class="fairness-context">
              <el-tag size="small">{{ row.fairness.pairId }}</el-tag>
              <el-tag size="small" type="info">{{ row.fairness.role }}</el-tag>
              <el-tag size="small" type="warning">{{ row.fairness.attribute }}: {{ row.fairness.group }}</el-tag>
            </div>
            <div v-if="row.personaId" class="persona-context">
              <strong>Persona: {{ row.personaId }}</strong>
              <dl>
                <template v-for="[key, value] in Object.entries(row.personaAttributes || {})" :key="key">
                  <dt>{{ key }}</dt>
                  <dd>{{ value }}</dd>
                </template>
              </dl>
              <div v-if="row.missingAttributes?.length" class="missing">
                Missing: {{ row.missingAttributes.join(', ') }}
              </div>
            </div>
            <p class="prompt-text">{{ row.text }}</p>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="Prompt">
        <template #default="{ row }">
          <div>
            <el-tag v-if="row.fairness?.pairId" size="small" type="warning" class="persona-tag">
              {{ row.fairness.pairId }} / {{ row.fairness.role }}
            </el-tag>
            <el-tag v-if="row.personaId" size="small" class="persona-tag">Persona: {{ row.personaId }}</el-tag>
            <span>{{ truncate(row.text) }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="Category" width="160">
        <template #default="{ row }">
          <el-tag>{{ row.category || 'Other' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="Action" width="150">
        <template #default="{ row }">
          <el-button text type="primary" @click.stop="copyPrompt(row as Prompt)">Copy prompt</el-button>
          <el-button text type="primary" :disabled="locked" @click.stop="$emit('edit', row as Prompt)">Edit</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed } from 'vue'

import type { Prompt, PromptPopulationSummary } from '@/types'

const props = defineProps<{
  prompts: Prompt[]
  categoryStats: Record<string, number>
  population: PromptPopulationSummary | null
  locked?: boolean
}>()

defineEmits<{
  add: []
  view: [prompt: Prompt]
  edit: [prompt: Prompt]
}>()

const categoryEntries = computed(() => Object.entries(props.categoryStats))
const counterfactualPairs = computed(() => {
  const pairs = new Map<string, { pairId: string; original?: Prompt; counterfactual?: Prompt }>()
  for (const prompt of props.prompts) {
    const pairId = prompt.fairness?.pairId
    if (!pairId) continue
    const row = pairs.get(pairId) || { pairId }
    if (prompt.fairness?.role === 'counterfactual') row.counterfactual = prompt
    else row.original = prompt
    pairs.set(pairId, row)
  }
  return Array.from(pairs.values()).sort((a, b) => a.pairId.localeCompare(b.pairId))
})

function truncate(text: string, length = 60) {
  if (text.length <= length) return text
  return `${text.slice(0, length)}...`
}

async function copyPrompt(prompt: Prompt) {
  await navigator.clipboard.writeText(prompt.text)
  ElMessage.success('Prompt copied.')
}
</script>

<style scoped>
.locked-hint {
  align-self: center;
  margin-right: 12px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.prompt-population-table {
  margin-bottom: 24px;
}
.summary-panel {
  padding: 16px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  margin-bottom: 16px;
}
.summary-panel h3 {
  margin: 0 0 12px;
}
.stats-bar {
  display: flex;
  align-items: center;
  gap: 32px;
  padding: 12px 0;
  flex-wrap: wrap;
}
.stat-block {
  display: flex;
  flex-direction: column;
}
.stat-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.stat-value {
  font-size: 20px;
  font-weight: 700;
}
.category-stats {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.category-stat {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 13px;
  color: var(--el-text-color-regular);
}
.category-count {
  font-weight: 600;
}
.pair-preview {
  margin-bottom: 16px;
}
.pair-preview p {
  margin: 6px 0 0;
  line-height: 1.5;
}
.table-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}
.persona-tag {
  margin-right: 8px;
}
.expanded-prompt {
  padding: 8px 32px;
}
.fairness-context,
.persona-context {
  margin-bottom: 12px;
}
.fairness-context {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
dl {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: 6px 12px;
  margin: 8px 0;
}
dt {
  color: var(--el-text-color-secondary);
}
dd {
  margin: 0;
  font-weight: 600;
}
.missing {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.prompt-text {
  margin: 0;
  white-space: pre-wrap;
  line-height: 1.6;
}
:deep(.el-table__row) {
  cursor: pointer;
}
</style>
