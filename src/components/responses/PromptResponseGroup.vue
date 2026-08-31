<template>
  <div class="prompt-groups">
    <el-collapse>
      <el-collapse-item v-for="group in groups" :key="group.promptId" :name="group.promptId">
        <template #title>
          <span class="group-title">Prompt #{{ group.promptIndex }} — {{ truncate(group.promptText) }}</span>
        </template>
        <p class="full-prompt">{{ group.promptText }}</p>
        <div v-for="item in group.items" :key="item.id" class="generation-block">
          <h5>Generation {{ item.generationIndex }}</h5>
          <p>{{ item.response }}</p>
        </div>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { ResponseItem } from '@/types'

const props = defineProps<{ responses: ResponseItem[] }>()

interface Group {
  promptId: string
  promptIndex: number
  promptText: string
  items: ResponseItem[]
}

const groups = computed(() => {
  const map = new Map<string, Group>()
  for (const item of props.responses) {
    if (!map.has(item.promptId)) {
      map.set(item.promptId, {
        promptId: item.promptId,
        promptIndex: item.promptIndex,
        promptText: item.promptText,
        items: [],
      })
    }
    map.get(item.promptId)!.items.push(item)
  }
  return Array.from(map.values()).sort((a, b) => a.promptIndex - b.promptIndex)
})

function truncate(text: string, length = 60) {
  if (text.length <= length) return text
  return `${text.slice(0, length)}...`
}
</script>

<style scoped>
.group-title {
  font-weight: 600;
}
.full-prompt {
  color: var(--el-text-color-secondary);
  white-space: pre-wrap;
  margin: 0 0 16px;
}
.generation-block {
  padding: 12px 0;
  border-top: 1px solid var(--el-border-color-lighter);
}
.generation-block h5 {
  margin: 0 0 6px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.generation-block p {
  margin: 0;
  white-space: pre-wrap;
  line-height: 1.6;
}
</style>
