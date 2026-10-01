import { defineStore } from "pinia";
import { computed, ref } from "vue";

import { createPoller } from "@/composables/usePolling";
import { formatApiError, parseApiError } from "@/services/api";
import { runApi } from "@/services/runApi";
import type { RunState, RunStatus } from "@/types";

const TERMINAL_STATES: RunState[] = ["completed", "failed"];

export const useRunStore = defineStore("run", () => {
	const evaluationId = ref<string | null>(null);
	const runId = ref<string | null>(null);
	const status = ref<RunState>("idle");
	const totalPrompts = ref(0);
	const completedPrompts = ref(0);
	const totalGenerations = ref(0);
	const completedGenerations = ref(0);
	const error = ref<string | null>(null);
	const heartbeatAt = ref<string | null>(null);
	const failedGenerations = ref(0);
	const external = ref(false);
	// Start/resume request in flight; used to disable the buttons.
	const starting = ref(false);
	// Error from a rejected start/resume request (e.g. 409 "already running",
	// 400 validation). Separate from `error`, which is the run's own failure.
	const startError = ref<string | null>(null);

	const progress = computed(() => {
		if (totalGenerations.value === 0) return 0;
		return Math.round(
			(completedGenerations.value / totalGenerations.value) * 100,
		);
	});

	let pollingRunId: string | null = null;
	const poller = createPoller<RunStatus>({
		fetch: () => {
			if (!pollingRunId) throw new Error("No run to poll.");
			return runApi.fetchRunStatus(pollingRunId);
		},
		onResult: (result) => {
			applyStatus(result);
			return TERMINAL_STATES.includes(result.status);
		},
	});
	const connectionLost = poller.connectionLost;

	function applyStatus(data: RunStatus) {
		runId.value = String(data.id);
		status.value = data.status;
		totalPrompts.value = data.totalPrompts;
		completedPrompts.value = data.completedPrompts;
		totalGenerations.value = data.totalGenerations;
		completedGenerations.value = data.completedGenerations;
		error.value = data.errorMessage || null;
		heartbeatAt.value = data.heartbeatAt;
		failedGenerations.value = data.failedGenerations;
		external.value = data.external;
	}

	function ensureEvaluation(nextEvaluationId: string | number) {
		const id = String(nextEvaluationId);
		if (evaluationId.value !== id) {
			reset();
			evaluationId.value = id;
		}
	}

	function isCurrent(id: string, signal?: AbortSignal) {
		return evaluationId.value === id && !signal?.aborted;
	}

	function trackResult(result: RunStatus, signal?: AbortSignal) {
		applyStatus(result);
		if (!TERMINAL_STATES.includes(result.status)) {
			startPolling(String(result.id), signal);
		}
	}

	async function startRun(nextEvaluationId: string | number, signal?: AbortSignal) {
		const id = String(nextEvaluationId);
		ensureEvaluation(id);
		if (starting.value) return null;
		starting.value = true;
		startError.value = null;
		try {
			const result = await runApi.startRun(id);
			if (!isCurrent(id)) return result;
			error.value = null;
			trackResult(result, signal);
			return result;
		} catch (e) {
			if (!isCurrent(id)) throw e;
			const apiError = parseApiError(e);
			startError.value = formatApiError(e, "Unable to start the evaluation run.");
			// 409: a run is already pending/running — attach to it. Network
			// error: the request may or may not have created a run — check.
			if (apiError.status === 409 || apiError.isNetworkError) {
				await restoreLatestRun(id, signal);
			}
			throw e;
		} finally {
			starting.value = false;
		}
	}

	async function resumeRun(nextEvaluationId: string | number, signal?: AbortSignal) {
		const id = String(nextEvaluationId);
		ensureEvaluation(id);
		if (!runId.value || status.value !== "failed" || external.value) {
			startError.value = "Only failed runs started from this evaluation can be resumed.";
			return null;
		}
		if (starting.value) return null;
		starting.value = true;
		startError.value = null;
		try {
			const result = await runApi.resumeRun(id, runId.value);
			if (!isCurrent(id)) return result;
			error.value = null;
			trackResult(result, signal);
			return result;
		} catch (e) {
			if (!isCurrent(id)) throw e;
			const apiError = parseApiError(e);
			startError.value = formatApiError(e, "Unable to resume the evaluation run.");
			if (apiError.status === 409 || apiError.isNetworkError) {
				await restoreLatestRun(id, signal);
			}
			throw e;
		} finally {
			starting.value = false;
		}
	}

	async function fetchRunStatus(runIdToFetch: string) {
		const result = await runApi.fetchRunStatus(runIdToFetch);
		applyStatus(result);
		if (TERMINAL_STATES.includes(result.status)) {
			stopPolling();
		}
		return result;
	}

	async function restoreLatestRun(
		nextEvaluationId: string | number,
		signal?: AbortSignal,
	) {
		const id = String(nextEvaluationId);
		ensureEvaluation(id);
		try {
			const result = await runApi.fetchLatestRun(id, signal);
			// The component may have unmounted or switched evaluation while
			// the request was in flight — never apply or start polling then.
			if (!isCurrent(id, signal)) return null;
			trackResult(result, signal);
			return result;
		} catch {
			return null;
		}
	}

	function startPolling(runIdToFetch: string, signal?: AbortSignal) {
		pollingRunId = runIdToFetch;
		poller.start(signal);
	}

	function stopPolling() {
		poller.stop();
	}

	function reset() {
		stopPolling();
		pollingRunId = null;
		evaluationId.value = null;
		runId.value = null;
		status.value = "idle";
		totalPrompts.value = 0;
		completedPrompts.value = 0;
		totalGenerations.value = 0;
		completedGenerations.value = 0;
		error.value = null;
		heartbeatAt.value = null;
		failedGenerations.value = 0;
		external.value = false;
		startError.value = null;
	}

	return {
		evaluationId,
		runId,
		status,
		totalPrompts,
		completedPrompts,
		totalGenerations,
		completedGenerations,
		progress,
		error,
		heartbeatAt,
		failedGenerations,
		external,
		starting,
		startError,
		connectionLost,
		ensureEvaluation,
		startRun,
		resumeRun,
		fetchRunStatus,
		restoreLatestRun,
		startPolling,
		stopPolling,
		reset,
	};
});
