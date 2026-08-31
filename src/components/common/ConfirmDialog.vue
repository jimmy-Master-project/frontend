<template>
  <el-dialog v-model="visible" :title="title" width="420px" align-center>
    <p class="confirm-message">{{ message }}</p>
    <template #footer>
      <el-button @click="handleCancel">{{ cancelText }}</el-button>
      <el-button :type="danger ? 'danger' : 'primary'" :loading="loading" @click="$emit('confirm')">
        {{ confirmText }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title?: string
    message: string
    confirmText?: string
    cancelText?: string
    danger?: boolean
    loading?: boolean
  }>(),
  {
    title: 'Confirm',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    danger: false,
    loading: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: []
  cancel: []
}>()

const visible = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

function handleCancel() {
  visible.value = false
  emit('cancel')
}
</script>

<style scoped>
.confirm-message {
  color: var(--el-text-color-regular);
  line-height: 1.6;
}
</style>
