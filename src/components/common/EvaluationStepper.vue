<template>
  <el-steps :active="active" finish-status="success" align-center class="evaluation-stepper">
    <el-step title="Use Case" />
    <el-step title="Prompt Population" />
    <el-step title="Target LLM" />
    <el-step title="Run" />
    <el-step title="Results" />
  </el-steps>
</template>

<script setup lang="ts">
defineProps<{ active: number }>()
</script>

<style scoped>
.evaluation-stepper {
  margin-bottom: 24px;
}
</style>
