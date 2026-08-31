<template>
  <el-drawer v-model="visible" title="Response Detail" size="480px">
    <template v-if="item">
      <section class="block">
        <h4>Prompt</h4>
        <p>{{ item.promptText }}</p>
      </section>
      <el-divider />
      <section class="block">
        <h4>Response</h4>
        <p>{{ item.response }}</p>
      </section>
      <el-divider />
      <div class="meta-grid">
        <div class="meta-item"><span class="label">Model</span><span>{{ item.model }}</span></div>
        <div class="meta-item"><span class="label">Generation</span><span>{{ item.generationIndex }}</span></div>
        <div class="meta-item"><span class="label">Input Tokens</span><span>{{ item.inputTokens }}</span></div>
        <div class="meta-item"><span class="label">Output Tokens</span><span>{{ item.outputTokens }}</span></div>
        <div class="meta-item">
          <span class="label">Latency</span><span>{{ (item.latencyMs / 1000).toFixed(1) }} sec</span>
        </div>
      </div>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { ResponseItem } from '@/types'

const props = defineProps<{ modelValue: boolean; item: ResponseItem | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const visible = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})
</script>

<style scoped>
.block h4 {
  margin: 0 0 8px;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--el-text-color-secondary);
}
.block p {
  white-space: pre-wrap;
  line-height: 1.6;
  margin: 0;
}
.meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.meta-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.meta-item .label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
</style>
