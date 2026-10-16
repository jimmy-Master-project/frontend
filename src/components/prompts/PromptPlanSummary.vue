<template>
  <el-alert :type="alertType" :closable="false" show-icon class="prompt-plan">
    <template #title>
      <template v-if="plan.maxPrompts">
        About {{ plan.maxPrompts }} prompt(s) · {{ plan.llmCalls }} prompt-agent call(s)
      </template>
      <template v-else>No prompts can be generated with this selection</template>
    </template>
    <ul>
      <li v-if="input.picked">
        <template v-if="plan.perPersona">
          {{ plan.usedPersonas }} persona(s) used in turn,
          {{ plan.perPersona[0] === plan.perPersona[1] ? plan.perPersona[0] : `${plan.perPersona[1]}–${plan.perPersona[0]}` }}
          prompt(s) each{{ input.objectiveCount > 1 ? ' per objective' : '' }}.
        </template>
        <template v-else>No usable persona selected.</template>
      </li>
      <li v-else>{{ input.promptCount }} personas sampled, one prompt each.</li>
      <li v-if="input.counterfactual">
        Gender counterfactuals: each prompt gets a gender-swapped twin (×2). Pairs whose text has no gendered word are dropped.
      </li>
      <li v-if="input.objectiveCount > 1">Repeated for each of the {{ input.objectiveCount }} task objectives (×{{ input.objectiveCount }}).</li>
      <li v-if="plan.excludedMissing.length" class="warn">
        Skipped, missing a diagnostic attribute: {{ plan.excludedMissing.join(', ') }}.
      </li>
      <li v-if="plan.skippedGender.length" class="warn">
        Skipped, gender is not man/woman ({{ plan.lostSlots }} slot(s) lost): {{ plan.skippedGender.join(', ') }}.
      </li>
      <li v-if="plan.outsideGroups.length" class="warn">
        Used for prompts but left out of that group comparison (value has no LangFair group): {{ plan.outsideGroups.join(', ') }}.
      </li>
      <li v-if="plan.unknownPersonas">Attributes of {{ plan.unknownPersonas }} selected persona(s) are not known yet; assumed usable.</li>
      <li v-if="!input.picked && input.counterfactual">Sampled personas whose gender is not man/woman are skipped, so the result can be smaller.</li>
    </ul>
  </el-alert>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { estimatePromptPlan, type PromptPlanInput } from '@/utils/promptPlan'

const props = defineProps<{ input: PromptPlanInput }>()

const plan = computed(() => estimatePromptPlan(props.input))
const alertType = computed(() =>
  !plan.value.maxPrompts ? 'error' : plan.value.excludedMissing.length || plan.value.skippedGender.length ? 'warning' : 'info',
)
</script>

<style scoped>
.prompt-plan { margin-top: 16px; }
.prompt-plan ul { margin: 6px 0 0; padding-left: 18px; font-size: 13px; line-height: 1.6; }
.warn { color: var(--el-color-warning-dark-2); }
</style>
