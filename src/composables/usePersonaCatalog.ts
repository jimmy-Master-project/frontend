import { computed, ref } from 'vue'

import { formatApiError } from '@/services/api'
import { personaApi } from '@/services/personaApi'
import type { PersonaAttribute, PersonaCatalog } from '@/types'

// Module-level cache: the catalog is global (not per evaluation), so every
// PersonaPopulationSettings instance shares one request and one result.
const attributes = ref<PersonaAttribute[]>([])
const pool = ref<string | undefined>(undefined)
// Mirrors the backend PersonaSampleRequestSerializer bounds (sampleSize 1..1000).
const SAMPLE_SIZE_MIN = 1
const SAMPLE_SIZE_MAX = 1000
const PREVIEW_SIZE_MAX = 50
const loading = ref(false)
const error = ref<string | null>(null)
const loaded = ref(false)

let inflight: Promise<PersonaCatalog | null> | null = null

const ATTRIBUTE_PRIORITY = new Map<string, number>([
  ['gender_identity', 0],
  ['age_bracket', 1],
  ['risk_tolerance', 2],
  ['region', 3],
  ['socioeconomic_band', 4],
])

export function humanizeKey(key: string) {
  return key
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function labelForRaw(attribute: PersonaAttribute) {
  return attribute.label || humanizeKey(attribute.key)
}

export function prioritizeAttributes(list: PersonaAttribute[]) {
  return [...list].sort((a, b) => {
    const priorityDiff = (ATTRIBUTE_PRIORITY.get(a.key) ?? 1000) - (ATTRIBUTE_PRIORITY.get(b.key) ?? 1000)
    if (priorityDiff !== 0) return priorityDiff
    return labelForRaw(a).localeCompare(labelForRaw(b))
  })
}

export function valuesFor(attribute: PersonaAttribute) {
  return attribute.values || []
}

export function isGenderAttribute(key: string) {
  return key === 'gender_identity' || key === 'gender'
}

/** Random sampling seed (used when the user leaves the seed on "random"). */
export function freshSeed() {
  return Math.floor(Math.random() * 2_147_483_647)
}

const attributeMap = computed(() => new Map(attributes.value.map(attribute => [attribute.key, attribute])))

function labelFor(key: string) {
  return attributeMap.value.get(key)?.label || humanizeKey(key)
}

/**
 * Loads the persona catalog once. Concurrent callers share the in-flight
 * request; `force` retries after a failure (e.g. MatrAIx was not ready).
 */
async function load(force = false): Promise<PersonaCatalog | null> {
  if (inflight) return inflight
  if (loaded.value && !force) return null
  loading.value = true
  error.value = null
  inflight = personaApi
    .getPersonaAttributes()
    .then(catalog => {
      attributes.value = prioritizeAttributes(catalog.attributes)
      pool.value = catalog.pool
      if (catalog.attributes.length === 0) {
        // Treat an empty catalog as "not ready" so the user gets a Retry.
        error.value = 'No persona attributes are available yet. The persona service may still be starting.'
        loaded.value = false
      } else {
        loaded.value = true
      }
      return catalog
    })
    .catch(e => {
      error.value = formatApiError(e, 'Network error while loading persona data.')
      loaded.value = false
      return null
    })
    .finally(() => {
      loading.value = false
      inflight = null
    })
  return inflight
}

export function usePersonaCatalog() {
  return {
    attributes: computed(() => attributes.value),
    attributeMap,
    pool: computed(() => pool.value),
    sampleSizeMin: computed(() => SAMPLE_SIZE_MIN),
    sampleSizeMax: computed(() => SAMPLE_SIZE_MAX),
    previewSizeMax: computed(() => PREVIEW_SIZE_MAX),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    loaded: computed(() => loaded.value),
    load,
    retry: () => load(true),
    labelFor,
    valuesFor,
  }
}
