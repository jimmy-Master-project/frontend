import { getCurrentInstance, onBeforeUnmount, readonly, ref } from 'vue'

import { isCanceledError } from '@/services/api'

export const CONNECTION_LOST_MESSAGE = '連線中斷，重試中'

export interface PollerOptions<T> {
  /** Performs one status request. */
  fetch: () => Promise<T>
  /**
   * Handles a successful response. Return `true` to stop polling (terminal
   * state reached). Throwing counts as a failed attempt and is retried.
   */
  onResult: (result: T) => boolean | void | Promise<boolean | void>
  /** Delay between successful polls, and the first backoff step. */
  intervalMs?: number
  /** Upper bound for the exponential backoff delay. */
  maxBackoffMs?: number
  /** Consecutive failures before `connectionLost` becomes true. */
  failureThreshold?: number
  /** Run the first request immediately instead of after one interval. */
  immediate?: boolean
}

/**
 * Sequential poller: the next request is only scheduled after the previous
 * one resolved (recursive setTimeout), responses from a stopped/restarted
 * poll are discarded (generation token), and request errors back off
 * exponentially (2s → 4s → 8s … capped). Errors never end polling by
 * themselves — only `onResult` decides when a terminal state was reached,
 * so a network blip can't be mistaken for a backend-reported failure.
 */
export function createPoller<T>(options: PollerOptions<T>) {
  const intervalMs = options.intervalMs ?? 2000
  const maxBackoffMs = options.maxBackoffMs ?? 30000
  const failureThreshold = options.failureThreshold ?? 3

  const active = ref(false)
  const connectionLost = ref(false)
  const consecutiveFailures = ref(0)

  let generation = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let detachSignal: (() => void) | null = null

  function clearTimer() {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  function schedule(token: number, delay: number) {
    clearTimer()
    timer = setTimeout(() => {
      timer = null
      void tick(token)
    }, delay)
  }

  async function tick(token: number) {
    if (token !== generation) return
    try {
      const result = await options.fetch()
      if (token !== generation) return
      const done = await options.onResult(result)
      if (token !== generation) return
      consecutiveFailures.value = 0
      connectionLost.value = false
      if (done) {
        stop()
        return
      }
      schedule(token, intervalMs)
    } catch (e) {
      if (token !== generation) return
      if (isCanceledError(e)) return
      consecutiveFailures.value += 1
      if (consecutiveFailures.value >= failureThreshold) connectionLost.value = true
      const delay = Math.min(intervalMs * 2 ** (consecutiveFailures.value - 1), maxBackoffMs)
      schedule(token, delay)
    }
  }

  /**
   * Starts (or restarts) polling. When `signal` is given, polling refuses to
   * start if it is already aborted and stops as soon as it aborts.
   */
  function start(signal?: AbortSignal) {
    stop()
    if (signal?.aborted) return false
    const token = ++generation
    active.value = true
    if (signal) {
      const onAbort = () => {
        if (token === generation) stop()
      }
      signal.addEventListener('abort', onAbort, { once: true })
      detachSignal = () => signal.removeEventListener('abort', onAbort)
    }
    if (options.immediate) void tick(token)
    else schedule(token, intervalMs)
    return true
  }

  function stop() {
    generation += 1
    clearTimer()
    detachSignal?.()
    detachSignal = null
    active.value = false
    connectionLost.value = false
    consecutiveFailures.value = 0
  }

  return {
    start,
    stop,
    active: readonly(active),
    connectionLost: readonly(connectionLost),
    consecutiveFailures: readonly(consecutiveFailures),
  }
}

export type Poller = ReturnType<typeof createPoller>

/**
 * AbortSignal tied to the calling component: aborted on unmount. Pass it to
 * store actions so async work that resolves after the component is gone
 * (e.g. "restore latest run") cannot start polling or apply state.
 */
export function useUnmountSignal() {
  const controller = new AbortController()
  if (getCurrentInstance()) {
    onBeforeUnmount(() => controller.abort())
  }
  return controller.signal
}

/**
 * Component-bound poller: stops automatically on unmount and cannot be
 * started after the component unmounted.
 */
export function usePolling<T>(options: PollerOptions<T>) {
  const signal = useUnmountSignal()
  const poller = createPoller(options)
  return {
    ...poller,
    start: () => poller.start(signal),
    signal,
  }
}
