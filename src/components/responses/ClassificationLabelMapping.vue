<template>
  <div class="label-mapping">
    <el-select v-model="positive" placeholder="Positive label" size="small" class="label-select">
      <el-option
        v-for="label in labels"
        :key="`positive-${label.value}`"
        :label="`${label.value} = ${label.name}`"
        :value="label.value"
      />
    </el-select>
    <el-select v-model="negative" placeholder="Negative label" size="small" class="label-select">
      <el-option
        v-for="label in labels"
        :key="`negative-${label.value}`"
        :label="`${label.value} = ${label.name}`"
        :value="label.value"
      />
    </el-select>
  </div>
</template>

<script setup lang="ts">
import type { ClassificationLabel } from '@/types'

defineProps<{ labels?: ClassificationLabel[] }>()

const positive = defineModel<number | null>('positive', { required: true })
const negative = defineModel<number | null>('negative', { required: true })
</script>

<style scoped>
.label-mapping {
  display: flex;
  align-items: center;
  gap: 12px;
}
.label-select {
  min-width: 220px;
}
</style>
