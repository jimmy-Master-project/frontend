<template>
  <el-dialog v-model="visible" :title="`Prompt #${prompt?.index ?? ''}`" width="560px">
    <template v-if="prompt">
      <div class="detail-field">
        <span class="label">Category</span>
        <el-tag>{{ prompt.category || 'Other' }}</el-tag>
      </div>
      <div v-if="prompt.personaId" class="detail-field">
        <span class="label">Persona</span>
        <strong>{{ prompt.personaId }}</strong>
        <dl v-if="Object.keys(prompt.personaAttributes || {}).length">
          <template v-for="[key, value] in Object.entries(prompt.personaAttributes || {})" :key="key">
            <dt>{{ key }}</dt>
            <dd>{{ value }}</dd>
          </template>
        </dl>
        <p v-if="prompt.missingAttributes?.length" class="missing">
          Missing: {{ prompt.missingAttributes.join(', ') }}
        </p>
      </div>
      <div class="detail-field">
        <span class="label">Prompt</span>
        <p class="prompt-text">{{ prompt.text }}</p>
      </div>
    </template>
    <template #footer>
      <el-button v-if="prompt" @click="copyPrompt(prompt)">Copy prompt</el-button>
      <el-button type="danger" plain :disabled="locked" @click="prompt && $emit('delete', prompt)">Delete</el-button>
      <el-button type="primary" :disabled="locked" @click="prompt && $emit('edit', prompt)">Edit</el-button>
      <el-button @click="visible = false">Close</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed } from 'vue'

import type { Prompt } from '@/types'

const props = defineProps<{ modelValue: boolean; prompt: Prompt | null; locked?: boolean }>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  edit: [prompt: Prompt]
  delete: [prompt: Prompt]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

async function copyPrompt(prompt: Prompt) {
  await navigator.clipboard.writeText(prompt.text)
  ElMessage.success('Prompt copied.')
}
</script>

<style scoped>
.detail-field {
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.prompt-text {
  white-space: pre-wrap;
  line-height: 1.6;
  margin: 0;
}
dl {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: 6px 12px;
  margin: 8px 0 0;
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
  margin: 6px 0 0;
}
</style>
