<template>
  <div v-if="personas.length" class="preview">
    <h3>Population Preview</h3>
    <p v-if="seed !== null && seed !== undefined" class="preview-seed">Sampled with seed {{ seed }}</p>
    <div class="preview-grid">
      <el-card v-for="persona in personas" :key="persona.personaId" shadow="never" class="preview-card">
        <h4>Persona {{ persona.personaId }}</h4>
        <dl>
          <template v-for="key in selectedAttributes" :key="key">
            <dt>{{ labelFor(key) }}</dt>
            <dd>{{ displayPersonaValue(persona, key) }}</dd>
          </template>
        </dl>
        <div v-if="persona.missingAttributes?.length" class="missing">
          Missing: {{ persona.missingAttributes.map(labelFor).join(', ') }}
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { usePersonaCatalog } from '@/composables/usePersonaCatalog'
import type { PersonaPreview } from '@/types'

defineProps<{
  personas: PersonaPreview[]
  selectedAttributes: string[]
  seed?: number | null
}>()

const { labelFor } = usePersonaCatalog()

function displayPersonaValue(persona: PersonaPreview, key: string) {
  if (persona.missingAttributes?.includes(key)) return 'Not available'
  return persona.attributes?.[key] ?? 'Not available'
}
</script>

<style scoped>
.preview h3 {
  margin: 20px 0 12px;
}
.preview-seed,
.missing {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.preview-seed {
  margin: -6px 0 12px;
}
.preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}
.preview-card h4 {
  margin: 0 0 12px;
}
dl {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 6px 10px;
  margin: 0;
}
dt {
  color: var(--el-text-color-secondary);
}
dd {
  margin: 0;
  font-weight: 600;
}
</style>
