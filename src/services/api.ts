import axios, { type AxiosError } from 'axios'

/**
 * Normalized error rejected by every request made through `api`.
 *
 * - `status` is the HTTP status, or `null` when no response was received
 *   (network drop, timeout, server restart, aborted request).
 * - `message` is the best human-readable reason found in the DRF body
 *   (`error`, `message`, `detail`, or the first field error).
 * - `fieldErrors` holds DRF field-level validation errors, flattened to
 *   `{ field: [messages] }` (nested keys are joined with ".").
 */
export class ApiError extends Error {
  status: number | null
  code: string | null
  fieldErrors: Record<string, string[]>
  data: unknown
  canceled: boolean

  constructor(init: {
    message: string
    status: number | null
    code?: string | null
    fieldErrors?: Record<string, string[]>
    data?: unknown
    canceled?: boolean
  }) {
    super(init.message)
    this.name = 'ApiError'
    this.status = init.status
    this.code = init.code ?? null
    this.fieldErrors = init.fieldErrors ?? {}
    this.data = init.data
    this.canceled = init.canceled ?? false
  }

  /** True when the request never got an HTTP response. */
  get isNetworkError() {
    return this.status === null && !this.canceled
  }

  /** First field error formatted as "field: message", if any. */
  get firstFieldError(): string | null {
    const [field, messages] = Object.entries(this.fieldErrors)[0] ?? []
    if (!field || !messages?.length) return null
    return field === 'non_field_errors' ? messages[0] : `${field}: ${messages[0]}`
  }
}

// Machine-readable error codes the backend returns in `error`.
const KNOWN_ERROR_CODES: Record<string, string> = {
  matraix_unavailable: 'Persona service is currently unavailable.',
  no_personas_matched: 'No personas matched the selected filters.',
  invalid_filters: 'Invalid persona filters.',
  missing_attributes: 'Selected persona attributes are unavailable.',
}

const RESERVED_KEYS = new Set(['error', 'message', 'detail', 'status', 'code'])

function collectFieldErrors(
  data: unknown,
  prefix: string,
  out: Record<string, string[]>,
) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (!prefix && RESERVED_KEYS.has(key)) continue
    const field = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') {
      out[field] = [value]
    } else if (Array.isArray(value)) {
      const messages = value.filter((item): item is string => typeof item === 'string')
      if (messages.length) out[field] = messages
      value.forEach((item, index) => {
        if (item && typeof item === 'object') collectFieldErrors(item, `${field}[${index}]`, out)
      })
    } else if (value && typeof value === 'object') {
      collectFieldErrors(value, field, out)
    }
  }
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

export function parseApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e

  if (axios.isCancel(e)) {
    return new ApiError({ message: 'Request canceled.', status: null, canceled: true })
  }

  const axiosError = e as AxiosError | undefined
  if (axiosError && axios.isAxiosError(axiosError)) {
    const response = axiosError.response
    if (!response) {
      const timedOut = axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT'
      return new ApiError({
        message: timedOut ? 'Request timed out.' : 'Unable to reach the server.',
        status: null,
        canceled: axiosError.code === 'ERR_CANCELED',
      })
    }

    const data = response.data
    const body = data && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {}
    const fieldErrors: Record<string, string[]> = {}
    if (Array.isArray(data)) {
      const messages = data.filter((item): item is string => typeof item === 'string')
      if (messages.length) fieldErrors.non_field_errors = messages
    } else {
      collectFieldErrors(body, '', fieldErrors)
    }

    const rawError = nonEmptyString(body.error)
    const code = rawError && KNOWN_ERROR_CODES[rawError] ? rawError : nonEmptyString(body.code)
    const apiError = new ApiError({
      message: '',
      status: response.status,
      code,
      fieldErrors,
      data,
    })
    apiError.message =
      (rawError && KNOWN_ERROR_CODES[rawError]) ||
      nonEmptyString(body.message) ||
      rawError ||
      nonEmptyString(body.detail) ||
      apiError.firstFieldError ||
      (typeof data === 'string' && data.length < 300 ? nonEmptyString(data) : null) ||
      `Request failed with status ${response.status}.`
    return apiError
  }

  return new ApiError({
    message: e instanceof Error && e.message ? e.message : 'Unexpected error.',
    status: null,
  })
}

/**
 * Human-readable message for any thrown value. `fallback` is used when the
 * error carries no usable message (e.g. unknown non-API errors).
 */
export function formatApiError(e: unknown, fallback = 'Request failed.'): string {
  if (!e) return fallback
  const apiError = parseApiError(e)
  return apiError.message || fallback
}

export function isCanceledError(e: unknown) {
  return parseApiError(e).canceled
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000,
})

api.interceptors.response.use(
  response => response,
  error => Promise.reject(parseApiError(error)),
)

export default api
