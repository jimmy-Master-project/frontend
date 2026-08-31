<template>
  <el-dialog v-model="visible" :title="`Prompt #${prompt?.index ?? ''}`" width="560px">
    <template v-if="prompt">
      <div class="detail-field">
        <span class="label">Category</span>
        <el-tag>{{ prompt.category || 'Other' }}</el-tag>
      </div>
      <div v-if="prompt.persona_id" class="detail-field">
        <span class="label">Persona</span>
        <strong>{{ prompt.persona_id }}</strong>
        <dl v-if="Object.keys(prompt.persona_attributes || {}).length">
          <template v-for="[key, value] in Object.entries(prompt.persona_attributes || {})" :key="key">
            <dt>{{ key }}</dt>
            <dd>{{ value }}</dd>
          </template>
        </dl>
        <p v-if="prompt.missing_attributes?.length" class="missing">
          Missing: {{ prompt.missing_attributes.join(', ') }}
        </p>
      </div>
      <div class="detail-field">
        <span class="label">Prompt</span>
        <p class="prompt-text">{{ prompt.prompt }}</p>
      </div>
    </template>
    <template #footer>
      <el-button v-if="prompt" @click="copyPrompt(prompt)">Copy prompt</el-button>
      <el-button type="danger" plain @click="prompt && $emit('delete', prompt)">Delete</el-button>
      <el-button type="primary" @click="prompt && $emit('edit', prompt)">Edit</el-button>
      <el-button @click="visible = false">Close</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed } from 'vue'

import type { Prompt } from '@/types'

const props = defineProps<{ modelValue: boolean; prompt: Prompt | null }>()
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
  await navigator.clipboard.writeText(prompt.prompt)
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
