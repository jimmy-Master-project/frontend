<template>
  <el-dialog v-model="visible" title="Edit Prompt" width="560px">
    <el-form label-position="top">
      <el-form-item label="Prompt">
        <el-input v-model="form.prompt" type="textarea" :rows="6" />
      </el-form-item>
      <el-form-item label="Category">
        <el-input v-model="form.category" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">Cancel</el-button>
      <el-button type="primary" :loading="saving" @click="handleSave">Save</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue'

import type { Prompt } from '@/types'

const props = defineProps<{ modelValue: boolean; prompt: Prompt | null; saving?: boolean }>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  save: [payload: { prompt: string; category: string }]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

const form = reactive({ prompt: '', category: '' })

watch(
  () => props.prompt,
  value => {
    form.prompt = value?.prompt ?? ''
    form.category = value?.category ?? ''
  },
  { immediate: true },
)

function handleSave() {
  emit('save', { ...form })
}
</script>
