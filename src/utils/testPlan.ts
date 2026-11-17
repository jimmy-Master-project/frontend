/**
 * Helpers for the initial prompt agent (backend apps/prompt_agents/planner.py).
 * Pure functions so they can be unit-tested without mounting components.
 */
import type {
  BiasRisk,
  TestPlanProtectedAttribute,
  TaskObjective,
  TestPlanDirection,
  TestPlanRequest,
  TestPlanTargetInfo,
  TestTechnique,
} from '@/types'

export const TECHNIQUE_LABELS: Record<TestTechnique, string> = {
  equivalence_partitioning: 'Equivalence partitioning',
  boundary_value: 'Boundary value',
  decision_table: 'Decision table',
  state_transition: 'State transition',
  combinatorial: 'Combinatorial',
  error_guessing: 'Error guessing',
}

export const BIAS_RISK_LABELS: Record<BiasRisk, string> = {
  counterfactual_fairness: 'Counterfactual fairness',
  performance_disparity: 'Performance disparity',
  stereotypical_association: 'Stereotypical association',
  control: 'Control',
}

export const BIAS_RISK_TAG_TYPES: Record<BiasRisk, 'primary' | 'warning' | 'danger' | 'info'> = {
  counterfactual_fairness: 'primary',
  performance_disparity: 'warning',
  stereotypical_association: 'danger',
  control: 'info',
}

export const PROTECTED_ATTRIBUTE_OPTIONS: { value: TestPlanProtectedAttribute; label: string }[] = [
  { value: 'gender', label: 'Gender' },
  { value: 'race_ethnicity', label: 'Race / ethnicity' },
]

// Default stages; must match WHEN_STAGES in planner.py.
export const WHEN_STAGE_LABELS: Record<string, string> = {
  before_travel: 'Before travel',
  at_airport: 'At airport',
  during_disruption: 'During disruption',
  after_travel: 'After travel',
}

export const AIRLINE_WHEN_STAGES = Object.keys(WHEN_STAGE_LABELS)

/** Same normalization as when_options() in planner.py: "After decision" -> "after_decision". */
export function toStageKey(value: string): string {
  return (value.toLowerCase().match(/[a-z0-9]+/g) ?? []).join('_')
}

export function whenLabel(stage: string): string {
  if (WHEN_STAGE_LABELS[stage]) return WHEN_STAGE_LABELS[stage]
  const text = stage.replace(/_/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export interface TestPlanForm extends TestPlanTargetInfo {
  modelName: string
  protectedAttributes: TestPlanProtectedAttribute[]
  totalDirections: number
  temperature: number
}

export function defaultTestPlanForm(): TestPlanForm {
  return {
    modelName: '',
    knownPolicies: '',
    systemPromptExcerpt: '',
    userPopulation: '',
    riskPriorities: '',
    whenStages: [...AIRLINE_WHEN_STAGES],
    protectedAttributes: ['gender', 'race_ethnicity'],
    totalDirections: 12,
    temperature: 0.7,
  }
}

/** Request body for a preview (apply=false); blank fields are left out. */
export function buildTestPlanRequest(form: TestPlanForm): TestPlanRequest {
  const targetInfo: Partial<TestPlanTargetInfo> = {}
  for (const key of ['knownPolicies', 'systemPromptExcerpt', 'userPopulation', 'riskPriorities'] as const) {
    const value = form[key].trim()
    if (value) targetInfo[key] = value
  }
  const stages = [...new Set(form.whenStages.map(toStageKey).filter(Boolean))]
  if (stages.length) targetInfo.whenStages = stages
  const request: TestPlanRequest = {
    targetInfo,
    protectedAttributes: [...form.protectedAttributes],
    totalDirections: form.totalDirections,
    temperature: form.temperature,
    apply: false,
  }
  const modelName = form.modelName.trim()
  if (modelName) request.modelName = modelName
  return request
}

/** Directions the user kept, as task objectives (blank objectives dropped). */
export function directionsToObjectives(directions: TestPlanDirection[]): TaskObjective[] {
  return directions
    .map(direction => ({ ...direction, objective: direction.objective.trim() }))
    .filter(direction => direction.objective)
}

/** True when at least one objective came from the initial prompt agent. */
export function isPlannedObjectives(objectives?: TaskObjective[] | null): boolean {
  return (objectives ?? []).some(item => Boolean(item?.technique))
}

/** Test direction x when grid of the given directions (rows follow the test direction order). */
export function coverageGrid(directions: TaskObjective[], testDirections: string[], stages?: string[]) {
  const whens = stages?.length ? [...stages] : [...AIRLINE_WHEN_STAGES]
  const rows = testDirections.map((testDirection, i) => {
    const mine = directions.filter(d => d.test_direction_index === i + 1)
    return {
      index: i + 1,
      testDirection,
      total: mine.length,
      cells: whens.map(when => mine.filter(d => d.helm_scenario?.when === when).length),
    }
  })
  const totalCells = testDirections.length * whens.length
  const filled = rows.reduce((sum, row) => sum + row.cells.filter(count => count > 0).length, 0)
  const uncovered = rows.filter(row => row.total === 0).map(row => row.index)
  return { whens, rows, filled, totalCells, coverage: totalCells ? filled / totalCells : 0, uncovered }
}

/** Test directions typed one per line: trimmed, blanks and duplicates removed. */
export function parseTestDirections(text: string): string[] {
  return [...new Set(text.split(/\r?\n/).map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean))]
}
