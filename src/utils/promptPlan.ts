/**
 * Pre-generation estimate of a persona prompt population, mirroring the
 * backend rules (apps/prompts/services/generation.py + counterfactual.py):
 *
 * - personas missing a diagnostic attribute are dropped;
 * - the remaining personas fill `promptCount` slots in turn (A,B,C,A,B,…),
 *   one prompt-agent call per slot;
 * - with gender counterfactuals each slot yields an original + a swapped
 *   prompt, and personas whose gender is not man/woman are skipped entirely;
 * - everything repeats once per task objective.
 */
import type { TaskObjective } from '@/types'

/** What is known about one hand-picked persona (null = not loaded yet). */
export interface PickedPersonaInfo {
  id: string
  name: string
  hasDiagnostics: boolean | null
  gender: string | null
  /** Labels (e.g. "Race / ethnicity") whose value has no LangFair group; null = not loaded. */
  outsideGroups?: string[] | null
}

export interface PromptPlanInput {
  promptCount: number
  objectiveCount: number
  counterfactual: boolean
  /** Hand-picked personas, or null for random sampling. */
  picked: PickedPersonaInfo[] | null
}

export interface PromptPlan {
  /** Prompt-agent (LLM) calls in total. */
  llmCalls: number
  /** Upper bound of generated prompts (swap pairs with no gendered word are dropped). */
  maxPrompts: number
  /** Personas actually used (pick mode). */
  usedPersonas: number
  /** Prompts per used persona (pick mode), e.g. [10, 10] or [13, 12]. */
  perPersona: [number, number] | null
  excludedMissing: string[]
  skippedGender: string[]
  /** Slots lost because their persona has an unsupported gender. */
  lostSlots: number
  unknownPersonas: number
  /** "<persona>: <label>" for personas left out of a non-counterfactual group comparison. */
  outsideGroups: string[]
}

/** Same rule as the backend's get_task_objectives (empty → 1 use-case objective). */
export function countObjectives(objectives?: TaskObjective[] | null): number {
  const filled = (objectives ?? []).filter(item => typeof item?.objective === 'string' && item.objective.trim())
  return Math.max(filled.length, 1)
}

/** Backend normalize_gender: only man / woman have a counterfactual. */
export function hasSwappableGender(value: string | null | undefined): boolean {
  return ['m', 'man', 'men', 'male', 'f', 'woman', 'women', 'female'].includes(String(value ?? '').trim().toLowerCase())
}

export function estimatePromptPlan(input: PromptPlanInput): PromptPlan {
  const slots = Math.max(0, Math.floor(input.promptCount))
  const objectives = Math.max(1, input.objectiveCount)
  const factor = input.counterfactual ? 2 : 1

  if (!input.picked) {
    return {
      llmCalls: slots * objectives,
      maxPrompts: slots * factor * objectives,
      usedPersonas: slots,
      perPersona: null,
      excludedMissing: [],
      skippedGender: [],
      lostSlots: 0,
      unknownPersonas: 0,
      outsideGroups: [],
    }
  }

  const unique = input.picked.filter((item, index, all) => all.findIndex(other => other.id === item.id) === index)
  const usable = unique.filter(item => item.hasDiagnostics !== false)
  const excludedMissing = unique.filter(item => item.hasDiagnostics === false).map(item => item.name || item.id)
  const n = usable.length
  if (!n) {
    return {
      llmCalls: 0,
      maxPrompts: 0,
      usedPersonas: 0,
      perPersona: null,
      excludedMissing,
      skippedGender: [],
      lostSlots: 0,
      unknownPersonas: unique.filter(item => item.hasDiagnostics === null).length,
      outsideGroups: [],
    }
  }

  // Slot i goes to usable[i % n]: the first (slots % n) personas get one extra.
  const base = Math.floor(slots / n)
  const extra = slots % n
  const slotsFor = (index: number) => base + (index < extra ? 1 : 0)

  let lostSlots = 0
  const skippedGender: string[] = []
  if (input.counterfactual) {
    usable.forEach((item, index) => {
      // Unknown gender (persona not loaded) is assumed swappable.
      if (item.gender !== null && !hasSwappableGender(item.gender)) {
        lostSlots += slotsFor(index)
        skippedGender.push(item.name || item.id)
      }
    })
  }
  const calls = slots - lostSlots
  const skipped = new Set(skippedGender)
  return {
    llmCalls: calls * objectives,
    maxPrompts: calls * factor * objectives,
    // Fewer slots than personas leaves the last ones unused.
    usedPersonas: usable.filter((item, index) => slotsFor(index) > 0 && !skipped.has(item.name || item.id)).length,
    perPersona: [slotsFor(0), slotsFor(Math.max(Math.min(n, slots), 1) - 1)],
    excludedMissing,
    skippedGender,
    lostSlots,
    unknownPersonas: usable.filter(item => item.hasDiagnostics === null).length,
    outsideGroups: usable.flatMap(item => (item.outsideGroups ?? []).map(label => `${item.name || item.id} (${label})`)),
  }
}
