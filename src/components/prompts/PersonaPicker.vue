<template>
  <div class="persona-picker">
    <div class="picker-toolbar">
      <el-input v-model="search" clearable placeholder="Search loaded personas (e.g. Woman, 25-34, Engineer)…" class="search" />
      <span class="muted">
        Showing {{ visibleCards.length }} of {{ allCards.length }} loaded<template v-if="total"> · {{ total.toLocaleString() }} available</template>
      </span>
      <el-button text :disabled="!visibleCards.length" @click="selectVisible">Select all shown</el-button>
    </div>

    <el-alert v-if="error" type="error" :title="error" :closable="false" show-icon class="gap">
      <el-button size="small" :loading="loading" @click="loadMore">Retry</el-button>
    </el-alert>

    <el-table
      v-loading="loading && !cards.length"
      :data="visibleCards"
      row-key="personaId"
      max-height="420"
      size="small"
      empty-text="No personas loaded."
      @expand-change="(row: PersonaCard) => loadDetail(row.personaId)"
    >
      <el-table-column width="44">
        <template #default="{ row }">
          <el-checkbox :model-value="selectedSet.has((row as PersonaCard).personaId)" @change="toggle((row as PersonaCard).personaId)" />
        </template>
      </el-table-column>
      <el-table-column type="expand" width="36">
        <template #default="{ row }">
          <div class="detail">
            <div v-if="detailLoading.has((row as PersonaCard).personaId)" class="muted">Loading attributes…</div>
            <dl v-else-if="details[(row as PersonaCard).personaId]">
              <template v-for="(value, key) in details[(row as PersonaCard).personaId]" :key="key">
                <dt>{{ catalog.labelFor(String(key)) }}</dt>
                <dd>{{ value }}</dd>
              </template>
            </dl>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="Persona" min-width="170">
        <template #default="{ row }">
          <div class="persona-name">
            <b>{{ (row as PersonaCard).name || (row as PersonaCard).personaId }}</b>
            <small>{{ (row as PersonaCard).personaId }}</small>
          </div>
        </template>
      </el-table-column>
      <el-table-column v-for="key in diagnosticAttributes" :key="key" :label="catalog.labelFor(key)" min-width="130">
        <template #default="{ row }">
          <template v-if="attributeValue(row as PersonaCard, key)">
            <span>{{ attributeValue(row as PersonaCard, key) }}</span>
            <el-tag v-if="catalog.protectedFor(key)" size="small" class="group-tag" :type="groupOf(row as PersonaCard, key) ? 'info' : 'warning'">
              {{ groupOf(row as PersonaCard, key) ?? 'no LangFair group' }}
            </el-tag>
          </template>
          <el-tag v-else type="warning" size="small">missing</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="Summary" min-width="220">
        <template #default="{ row }">
          <div class="summary">
            <el-tag v-for="(value, key) in (row as PersonaCard).summary" :key="key" size="small" effect="plain">{{ value }}</el-tag>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <div class="picker-footer">
      <el-button :loading="loading" :disabled="exhausted" @click="loadMore">
        {{ exhausted ? 'All personas loaded' : `Load ${PAGE_SIZE} more` }}
      </el-button>
    </div>

    <div class="selected-box">
      <div class="selected-head">
        <span class="panel-label">Selected personas</span>
        <strong>{{ selected.length }}</strong>
        <el-button v-if="selected.length" text type="primary" @click="selected = []">Clear</el-button>
      </div>
      <div v-if="selected.length" class="selected-tags">
        <el-tag v-for="id in selected" :key="id" closable @close="toggle(id)">{{ nameFor(id) }}</el-tag>
      </div>
      <p v-else class="muted">Tick personas in the list. Only these personas will be used to generate prompts.</p>
      <p v-if="missingSelected.length" class="warn">
        {{ missingSelected.length }} selected persona(s) lack a diagnostic attribute and will be skipped during generation.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Browse the persona pool page by page (first PAGE_SIZE, then "Load more")
 * and hand-pick the personas used for prompt generation.
 */
import { computed, onMounted, reactive, ref, watch } from 'vue'

import { usePersonaCatalog } from '@/composables/usePersonaCatalog'
import { formatApiError } from '@/services/api'
import { personaApi } from '@/services/personaApi'
import type { PersonaCard } from '@/types'
import type { PickedPersonaInfo } from '@/utils/promptPlan'

const props = defineProps<{
  pool?: string
  /** Attributes being diagnosed: shown as columns, flagged when missing. */
  diagnosticAttributes: string[]
}>()
const selected = defineModel<string[]>('selected', { required: true })
const emit = defineEmits<{ 'selection-info': [info: PickedPersonaInfo[]] }>()

const PAGE_SIZE = 50
const catalog = usePersonaCatalog()

const cards = ref<PersonaCard[]>([])
// Selected personas outside the loaded pages (e.g. reused from the previous
// population): fetched by id and listed first.
const pinnedCards = ref<PersonaCard[]>([])
const total = ref<number | null>(null)
const loading = ref(false)
const error = ref('')
const exhausted = ref(false)
const search = ref('')
const details = reactive<Record<string, Record<string, string>>>({})
const detailLoading = reactive(new Set<string>())

const selectedSet = computed(() => new Set(selected.value))
const allCards = computed(() => {
  const paged = new Set(cards.value.map(card => card.personaId))
  return [...pinnedCards.value.filter(card => !paged.has(card.personaId)), ...cards.value]
})
const cardById = computed(() => new Map(allCards.value.map(card => [card.personaId, card])))
const visibleCards = computed(() => {
  const terms = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return allCards.value
  return allCards.value.filter(card => {
    const text = `${card.name} ${card.searchText}`.toLowerCase()
    return terms.every(term => text.includes(term))
  })
})
const missingSelected = computed(() =>
  selected.value.filter(id => {
    const card = cardById.value.get(id)
    return card && props.diagnosticAttributes.some(key => !attributeValue(card, key))
  }),
)

onMounted(() => {
  void catalog.load()
  void loadMore()
})

// What is known about each selected persona, for the prompt-count estimate.
watch(
  () =>
    selected.value.map<PickedPersonaInfo>(id => {
      const card = cardById.value.get(id)
      if (!card) return { id, name: id, hasDiagnostics: null, gender: null, outsideGroups: null }
      return {
        id,
        name: card.name || id,
        hasDiagnostics: props.diagnosticAttributes.every(key => !!attributeValue(card, key)),
        gender: attributeValue(card, 'gender_identity') || attributeValue(card, 'gender') || null,
        // Non-counterfactual labels (race) whose value has no LangFair group.
        outsideGroups: props.diagnosticAttributes
          .filter(key => catalog.protectedFor(key) && !catalog.protectedFor(key)!.counterfactual)
          .filter(key => attributeValue(card, key) && !groupOf(card, key))
          .map(key => catalog.protectedFor(key)!.label),
      }
    }),
  info => emit('selection-info', info),
  { immediate: true, deep: true },
)

const pinning = new Set<string>()
watch(
  selected,
  async ids => {
    const unknown = ids.filter(id => !cardById.value.has(id) && !pinning.has(id))
    if (!unknown.length) return
    unknown.forEach(id => pinning.add(id))
    try {
      const found = await personaApi.listPersonasByIds(unknown, props.pool || undefined)
      pinnedCards.value = [...pinnedCards.value, ...found]
    } catch {
      // Names stay as ids; the selection itself is unaffected.
    } finally {
      unknown.forEach(id => pinning.delete(id))
    }
  },
  { immediate: true },
)

async function loadMore() {
  if (loading.value || exhausted.value) return
  loading.value = true
  error.value = ''
  try {
    const result = await personaApi.listPersonas({ offset: cards.value.length, limit: PAGE_SIZE, pool: props.pool || undefined })
    const known = new Set(cards.value.map(card => card.personaId))
    cards.value = [...cards.value, ...result.personas.filter(card => !known.has(card.personaId))]
    total.value = result.total
    if (result.personas.length < PAGE_SIZE || (result.total !== null && cards.value.length >= result.total)) {
      exhausted.value = true
    }
  } catch (e) {
    error.value = formatApiError(e, 'Unable to load personas.')
  } finally {
    loading.value = false
  }
}

async function loadDetail(personaId: string) {
  if (details[personaId] || detailLoading.has(personaId)) return
  detailLoading.add(personaId)
  try {
    details[personaId] = (await personaApi.getPersona(personaId, props.pool || undefined)).attributes
  } catch (e) {
    details[personaId] = { error: formatApiError(e, 'Unable to load this persona.') }
  } finally {
    detailLoading.delete(personaId)
  }
}

function toggle(personaId: string) {
  selected.value = selectedSet.value.has(personaId)
    ? selected.value.filter(id => id !== personaId)
    : [...selected.value, personaId]
}
function selectVisible() {
  const next = new Set(selected.value)
  for (const card of visibleCards.value) next.add(card.personaId)
  selected.value = [...next]
}
function groupOf(card: PersonaCard, key: string) {
  return catalog.langfairGroup(key, attributeValue(card, key))
}

function nameFor(personaId: string) {
  return cardById.value.get(personaId)?.name || personaId
}

// searchText is "key Value Words key2 Value …": a value runs until the next
// attribute key (a known catalog key or a lowercase snake_case token).
const KEY_TOKEN = /^[a-z][a-z0-9]*(_[a-z0-9]+)+$/
function attributeValue(card: PersonaCard, key: string): string {
  const fromDetail = details[card.personaId]?.[key]
  if (fromDetail) return fromDetail
  if (card.summary[key]) return card.summary[key]
  const tokens = card.searchText.split(/\s+/)
  const start = tokens.indexOf(key)
  if (start < 0) return ''
  const value: string[] = []
  for (const token of tokens.slice(start + 1)) {
    if (KEY_TOKEN.test(token) || catalog.attributeMap.value.has(token)) break
    value.push(token)
  }
  return value.join(' ')
}
</script>

<style scoped>
.picker-toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; }
.picker-toolbar .search { max-width: 360px; }
.gap { margin-bottom: 10px; }
.muted { color: var(--el-text-color-secondary); font-size: 13px; }
.warn { margin: 8px 0 0; color: var(--el-color-warning-dark-2); font-size: 13px; }
.persona-name { display: flex; flex-direction: column; }
.group-tag { margin-left: 6px; }
.persona-name small { color: var(--el-text-color-secondary); font-size: 11px; }
.summary, .selected-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.detail { padding: 6px 16px 10px 80px; }
.detail dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px 16px; margin: 0; font-size: 12px; max-height: 260px; overflow: auto; }
.detail dt { color: var(--el-text-color-secondary); }
.detail dd { margin: 0; }
.picker-footer { display: flex; justify-content: center; margin: 10px 0 14px; }
.selected-box { padding: 12px 14px; border: 1px solid var(--el-border-color-lighter); border-radius: 10px; background: var(--el-fill-color-extra-light); }
.selected-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.panel-label { color: var(--el-text-color-secondary); font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
.selected-tags { max-height: 110px; overflow: auto; }
</style>
