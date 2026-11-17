<template>
  <div class="persona-set-panel">
    <div class="set-toolbar">
      <el-select
        :model-value="setId ?? undefined"
        placeholder="Choose a saved persona list"
        filterable
        class="set-select"
        :loading="listLoading"
        data-test="persona-set-select"
        @update:model-value="(id: number) => selectSet(id)"
      >
        <el-option v-for="item in sets" :key="item.id" :label="setLabel(item)" :value="item.id" />
      </el-select>
      <el-button type="primary" plain @click="openDialog">+ Draw new list</el-button>
      <el-button text type="danger" :disabled="!current" @click="removeCurrent">Delete</el-button>
    </div>

    <el-alert v-if="error" type="error" :title="error" :closable="false" show-icon class="gap" />

    <div v-if="current" v-loading="detailLoading" class="set-detail">
      <p class="muted">
        {{ current.size }} personas · seed {{ current.seed }} ·
        <template v-if="conditionText(current)">conditions: {{ conditionText(current) }}</template>
        <template v-else>no conditions (whole pool)</template>
      </p>
      <el-table v-if="current.personas" :data="current.personas" size="small" max-height="320" row-key="personaId">
        <el-table-column label="Persona" prop="personaId" width="120" />
        <el-table-column v-for="key in shownKeys" :key="key" :label="catalog.labelFor(key)" min-width="130">
          <template #default="{ row }">{{ (row as PersonaPreview).attributes?.[key] ?? '—' }}</template>
        </el-table-column>
      </el-table>
    </div>
    <p v-else class="muted">No list chosen. Draw a new list or choose a saved one; the same list can be reused by any population.</p>

    <el-dialog v-model="dialogVisible" title="Draw personas" width="620px" append-to-body>
      <el-form label-position="top" @submit.prevent>
        <el-form-item label="List name" required>
          <el-input v-model="form.name" maxlength="200" placeholder="e.g. Nurses 30-44, n=40" />
        </el-form-item>
        <el-form-item label="Number of personas" required>
          <el-input-number v-model="form.size" :min="1" :max="1000" />
        </el-form-item>
        <el-form-item label="Conditions (any persona attribute; none = whole pool)">
          <div class="conditions">
            <div v-for="(row, index) in form.conditions" :key="index" class="condition-row">
              <el-select
                v-model="row.key"
                filterable
                placeholder="Attribute"
                class="condition-key"
                @change="row.values = []"
              >
                <el-option
                  v-for="attribute in filterableAttributes"
                  :key="attribute.key"
                  :label="catalog.labelFor(attribute.key)"
                  :value="attribute.key"
                  :disabled="usedKeys.has(attribute.key) && attribute.key !== row.key"
                />
              </el-select>
              <el-select
                v-model="row.values"
                multiple
                filterable
                collapse-tags
                collapse-tags-tooltip
                placeholder="Allowed values"
                class="condition-values"
                :disabled="!row.key"
              >
                <el-option v-for="value in valuesOf(row.key)" :key="value" :label="value" :value="value" />
              </el-select>
              <el-button text type="danger" @click="form.conditions.splice(index, 1)">Remove</el-button>
            </div>
            <el-button text type="primary" @click="form.conditions.push({ key: '', values: [] })">+ Add condition</el-button>
            <p class="muted">A persona must match every condition (any of the chosen values within one attribute).</p>
          </div>
        </el-form-item>
        <el-form-item label="Sampling">
          <div class="seed-row">
            <el-switch v-model="form.randomSeed" active-text="Random (default)" />
            <el-input-number v-if="!form.randomSeed" v-model="form.seed" :min="0" placeholder="Seed" />
          </div>
          <p class="muted">The seed actually used is saved with the list.</p>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">Cancel</el-button>
        <el-button type="primary" :loading="creating" :disabled="!canCreate" @click="create">Draw &amp; save</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'

import { usePersonaCatalog } from '@/composables/usePersonaCatalog'
import { formatApiError } from '@/services/api'
import { personaApi } from '@/services/personaApi'
import type { PersonaPreview, PersonaSet } from '@/types'

const props = defineProps<{
  /** Fairness labels; shown as columns next to the list's own conditions. */
  diagnosticAttributes: string[]
  pool?: string
}>()

const setId = defineModel<number | null>('setId', { default: null })
const emit = defineEmits<{ (e: 'personas', ids: string[]): void }>()

const catalog = usePersonaCatalog()

const sets = ref<PersonaSet[]>([])
const current = ref<PersonaSet | null>(null)
const listLoading = ref(false)
const detailLoading = ref(false)
const error = ref<string | null>(null)

const filterableAttributes = computed(() => catalog.attributes.value.filter(attribute => (attribute.values ?? []).length > 0))
const shownKeys = computed(() => [...new Set([...props.diagnosticAttributes, ...Object.keys(current.value?.filters ?? {})])])

function valuesOf(key: string) {
  return catalog.attributeMap.value.get(key)?.values ?? []
}

function conditionText(item: PersonaSet) {
  return Object.entries(item.filters)
    .map(([key, values]) => `${catalog.labelFor(key)} ∈ {${values.join(', ')}}`)
    .join('; ')
}

function setLabel(item: PersonaSet) {
  const date = item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''
  return `${item.name} · ${item.size} personas · ${date}`
}

async function loadSets() {
  listLoading.value = true
  try {
    sets.value = await personaApi.listSets()
  } catch (e) {
    error.value = formatApiError(e, 'Failed to load saved persona lists.')
  } finally {
    listLoading.value = false
  }
}

async function selectSet(id: number) {
  error.value = null
  setId.value = id
  const summary = sets.value.find(item => item.id === id) ?? null
  current.value = summary
  emit('personas', summary?.personaIds ?? [])
  detailLoading.value = true
  try {
    const detail = await personaApi.getSet(id)
    if (setId.value === id) current.value = detail
  } catch (e) {
    error.value = formatApiError(e, 'Failed to load the persona list.')
  } finally {
    detailLoading.value = false
  }
}

async function removeCurrent() {
  if (!current.value) return
  const target = current.value
  try {
    await ElMessageBox.confirm(
      `Delete the persona list "${target.name}"? Populations already generated from it keep their prompts.`,
      'Delete list',
      { type: 'warning' },
    )
  } catch {
    return
  }
  try {
    await personaApi.deleteSet(target.id)
    sets.value = sets.value.filter(item => item.id !== target.id)
    current.value = null
    setId.value = null
    emit('personas', [])
  } catch (e) {
    error.value = formatApiError(e, 'Failed to delete the persona list.')
  }
}

// ---- Draw dialog ----
const dialogVisible = ref(false)
const creating = ref(false)
const form = reactive({
  name: '',
  size: 20,
  conditions: [] as { key: string; values: string[] }[],
  randomSeed: true,
  seed: 42 as number | undefined,
})
const usedKeys = computed(() => new Set(form.conditions.map(row => row.key).filter(Boolean)))
const canCreate = computed(
  () => form.name.trim().length > 0 && form.size >= 1 && form.conditions.every(row => !row.key || row.values.length > 0),
)

function openDialog() {
  void catalog.load()
  form.name = ''
  form.conditions = []
  form.randomSeed = true
  dialogVisible.value = true
}

async function create() {
  creating.value = true
  const filters = Object.fromEntries(form.conditions.filter(row => row.key && row.values.length).map(row => [row.key, [...row.values]]))
  try {
    const created = await personaApi.createSet({
      name: form.name.trim(),
      sampleSize: form.size,
      filters,
      seed: form.randomSeed ? null : form.seed ?? 0,
      pool: props.pool || undefined,
    })
    sets.value = [created, ...sets.value]
    setId.value = created.id
    current.value = created
    emit('personas', created.personaIds)
    dialogVisible.value = false
    ElMessage.success(`Saved "${created.name}" (${created.size} personas, seed ${created.seed}).`)
  } catch (e) {
    ElMessage.error(formatApiError(e, 'Failed to draw personas.'))
  } finally {
    creating.value = false
  }
}

onMounted(async () => {
  void catalog.load()
  await loadSets()
  // Restore a list chosen earlier (e.g. after switching source back and forth).
  if (setId.value && sets.value.some(item => item.id === setId.value)) await selectSet(setId.value)
})
</script>

<style scoped>
.set-toolbar,
.seed-row,
.condition-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.set-select {
  width: 360px;
}
.gap {
  margin: 12px 0;
}
.set-detail {
  margin-top: 12px;
}
.muted {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.conditions {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.condition-key {
  width: 200px;
}
.condition-values {
  flex: 1;
  min-width: 200px;
}
</style>
