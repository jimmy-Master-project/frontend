<template>
  <span class="field-label">
    <span>{{ label }}</span>
    <el-popover v-if="help" trigger="click" placement="top-start" :width="320" :title="label">
      <template #reference>
        <!-- prevent: a click inside a form <label> would otherwise focus the input -->
        <button
          type="button"
          class="help-button"
          :aria-label="`About ${label}`"
          data-test="field-help"
          @click.prevent
        >
          <el-icon :size="14"><QuestionFilled /></el-icon>
        </button>
      </template>
      <div class="help-text" data-test="field-help-text">{{ help }}</div>
    </el-popover>
  </span>
</template>

<script setup lang="ts">
import { QuestionFilled } from '@element-plus/icons-vue'

defineProps<{
  label: string
  /** What the field does and why; shown when the help icon is clicked. */
  help?: string
}>()
</script>

<style scoped>
.field-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.help-button {
  display: inline-flex;
  align-items: center;
  padding: 0;
  border: 0;
  background: none;
  color: var(--el-text-color-placeholder);
  cursor: pointer;
}
.help-button:hover,
.help-button:focus-visible {
  color: var(--el-color-primary);
}
.help-text {
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-line;
}
</style>
