<template>
  <div class="persona-attribute-picker">
    <div class="attribute-toolbar">
      <el-input v-model="search" clearable placeholder="Search attributes, e.g. gender_identity, age_bracket, risk_tolerance">
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
      <div class="catalog-meta">
        <el-tag type="info">{{ attributes.length }} attributes</el-tag>
        <el-tag v-if="filteredAttributeCount !== attributes.length" type="warning">
          {{ filteredAttributeCount }} matched
        </el-tag>
      </div>
    </div>

    <LoadingState v-if="loading" text="Loading persona attributes..." />
    <div v-else class="attribute-picker">
      <aside class="category-sidebar">
        <button
          type="button"
          class="category-button"
          :class="{ active: activeCategory === 'all' }"
          @click="activeCategory = 'all'"
        >
          <span>All attributes</span>
          <small>{{ filteredAttributeCount }}</small>
        </button>
        <button
          v-for="group in filteredGroups"
          :key="group.category"
          type="button"
          class="category-button"
          :class="{ active: activeCategory === group.category }"
          @click="activeCategory = group.category"
        >
          <span>{{ group.category }}</span>
          <small>{{ group.attributes.length }}</small>
        </button>
      </aside>

      <section class="attribute-results">
        <div class="results-header">
          <div>
            <h3>{{ activeCategoryTitle }}</h3>
            <p>{{ visibleAttributes.length }} available dimensions</p>
          </div>
          <el-button v-if="visibleAttributes.length" size="small" @click="selectVisibleAttributes">
            Select visible
          </el-button>
        </div>

        <el-empty v-if="visibleAttributes.length === 0" description="No attributes match your search." :image-size="80" />
        <div v-else class="attribute-card-grid">
          <button
            v-for="attribute in visibleAttributes"
            :key="attribute.key"
            type="button"
            class="attribute-card"
            :class="{ selected: isSelected(attribute.key) }"
            @click="toggleAttribute(attribute.key)"
          >
            <div class="attribute-card-main">
              <el-checkbox :model-value="isSelected(attribute.key)" @click.stop @change="toggleAttribute(attribute.key)" />
              <div>
                <strong>{{ labelFor(attribute.key) }}</strong>
                <code>{{ attribute.key }}</code>
              </div>
            </div>
            <p v-if="attribute.description" class="attribute-description">{{ attribute.description }}</p>
            <div class="attribute-card-footer">
              <el-tag size="small" effect="plain">{{ attribute.category || 'Other' }}</el-tag>
              <span v-if="valuesFor(attribute).length" class="value-count">
                {{ valuesFor(attribute).length }} values
              </span>
            </div>
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Search } from '@element-plus/icons-vue'
import { computed, ref, watch } from 'vue'

import LoadingState from '@/components/common/LoadingState.vue'
import { usePersonaCatalog } from '@/composables/usePersonaCatalog'
import type { PersonaAttribute } from '@/types'

const props = defineProps<{
  attributes: PersonaAttribute[]
  loading?: boolean
}>()

const selected = defineModel<string[]>('selected', { required: true })

const { labelFor, valuesFor } = usePersonaCatalog()

const search = ref('')
const activeCategory = ref('all')

const groupedAttributes = computed(() => {
  const groups = new Map<string, PersonaAttribute[]>()
  for (const attribute of props.attributes) {
    const category = attribute.category || 'Other'
    if (!groups.has(category)) groups.set(category, [])
    groups.get(category)?.push(attribute)
  }
  return Array.from(groups, ([category, groupAttributes]) => ({ category, attributes: groupAttributes }))
})

const filteredGroups = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  if (!keyword) return groupedAttributes.value
  return groupedAttributes.value
    .map(group => ({
      category: group.category,
      attributes: group.attributes.filter(attribute =>
        [attribute.key, attribute.label, attribute.description, attribute.category]
          .filter(Boolean)
          .some(value => String(value).toLowerCase().includes(keyword)),
      ),
    }))
    .filter(group => group.attributes.length > 0)
})

const filteredAttributeCount = computed(() => filteredGroups.value.reduce((total, group) => total + group.attributes.length, 0))

const visibleAttributes = computed(() => {
  if (activeCategory.value === 'all') return filteredGroups.value.flatMap(group => group.attributes)
  return filteredGroups.value.find(group => group.category === activeCategory.value)?.attributes || []
})

const activeCategoryTitle = computed(() => (activeCategory.value === 'all' ? 'All attributes' : activeCategory.value))

watch(filteredGroups, groups => {
  if (activeCategory.value !== 'all' && !groups.some(group => group.category === activeCategory.value)) {
    activeCategory.value = 'all'
  }
})

function isSelected(key: string) {
  return selected.value.includes(key)
}

function toggleAttribute(key: string) {
  selected.value = isSelected(key) ? selected.value.filter(value => value !== key) : [...selected.value, key]
}

function selectVisibleAttributes() {
  const next = new Set(selected.value)
  for (const attribute of visibleAttributes.value) next.add(attribute.key)
  selected.value = Array.from(next)
}
</script>

<style scoped>
.attribute-toolbar,
.results-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.attribute-toolbar {
  margin-bottom: 14px;
}
.catalog-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  flex: 0 0 auto;
}
.attribute-picker {
  display: grid;
  grid-template-columns: 230px 1fr;
  min-height: 420px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 12px;
  overflow: hidden;
}
.category-sidebar {
  padding: 10px;
  background: var(--el-fill-color-light);
  border-right: 1px solid var(--el-border-color-light);
  max-height: 560px;
  overflow: auto;
}
.category-button {
  width: 100%;
  border: 0;
  border-radius: 8px;
  background: transparent;
  padding: 10px 12px;
  color: var(--el-text-color-regular);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  text-align: left;
  gap: 10px;
}
.category-button:hover {
  background: var(--el-fill-color);
}
.category-button.active {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  font-weight: 700;
}
.category-button small {
  color: var(--el-text-color-secondary);
}
.attribute-results {
  padding: 16px;
  max-height: 560px;
  overflow: auto;
}
.results-header {
  margin-bottom: 14px;
}
.results-header h3,
.results-header p {
  margin: 0;
}
.results-header p,
.attribute-description,
.value-count {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.attribute-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(245px, 1fr));
  gap: 12px;
}
.attribute-card {
  border: 1px solid var(--el-border-color-light);
  border-radius: 12px;
  padding: 12px;
  background: var(--el-bg-color);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
}
.attribute-card:hover {
  border-color: var(--el-color-primary-light-5);
  box-shadow: var(--el-box-shadow-lighter);
}
.attribute-card.selected {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.attribute-card-main {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.attribute-card strong,
.attribute-card code {
  display: block;
}
.attribute-card code {
  margin-top: 3px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  word-break: break-all;
}
.attribute-description {
  margin: 10px 0 0;
}
.attribute-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 12px;
}
@media (max-width: 900px) {
  .attribute-picker {
    grid-template-columns: 1fr;
  }
  .category-sidebar {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    border-right: 0;
    border-bottom: 1px solid var(--el-border-color-light);
  }
  .category-button {
    min-width: 180px;
  }
}
</style>
