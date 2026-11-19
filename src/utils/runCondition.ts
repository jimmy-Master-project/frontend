import type { RunStatus } from '@/types'

/** One line describing the experiment condition a run belongs to. */
export function conditionLabel(run: RunStatus) {
  const injected = run.llmSnapshot?.systemPrompt ? 'system prompt injected' : ''
  const condition = run.condition
  if (!condition) return [run.promptPopulationId ? `population #${run.promptPopulationId}` : '', injected].filter(Boolean).join(' · ')
  const persona = condition.personaBased
    ? condition.personaSetName
      ? `personas: ${condition.personaSetName}`
      : 'personas'
    : condition.generationMode === 'template_counterfactual'
      ? 'no personas (template pairs)'
      : 'no personas'
  return [
    `${condition.populationName || 'Unnamed'} #${run.promptPopulationId}`,
    persona,
    condition.objectiveCount !== null ? `${condition.objectiveCount} directions` : '',
    condition.directionStrategies.length ? `strategy: ${condition.directionStrategies.join(', ')}` : '',
    injected,
  ]
    .filter(Boolean)
    .join(' · ')
}
