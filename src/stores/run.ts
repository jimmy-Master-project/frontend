import { defineStore } from "pinia";
import { computed, ref } from "vue";

import { runApi } from "@/services/runApi";
import type { RunState, RunStatus } from "@/types";

export const useRunStore = defineStore("run", () => {
	const evaluationId = ref<string | null>(null);
	const runId = ref<string | null>(null);
	const status = ref<RunState>("idle");
	const totalPrompts = ref(0);
	const completedPrompts = ref(0);
	const totalGenerations = ref(0);
	const completedGenerations = ref(0);
	const error = ref<string | null>(null);

	const progress = computed(() => {
		if (totalGenerations.value === 0) return 0;
		return Math.round(
			(completedGenerations.value / totalGenerations.value) * 100,
		);
	});

	let pollTimer: ReturnType<typeof setInterval> | null = null;

	function applyStatus(data: Partial<RunStatus>) {
		if (data.runId !== undefined) runId.value = data.runId;
		if (data.status !== undefined) status.value = data.status;
		if (data.totalPrompts !== undefined) totalPrompts.value = data.totalPrompts;
		if (data.completedPrompts !== undefined)
			completedPrompts.value = data.completedPrompts;
		if (data.totalGenerations !== undefined)
			totalGenerations.value = data.totalGenerations;
		if (data.completedGenerations !== undefined)
			completedGenerations.value = data.completedGenerations;
		if (data.error !== undefined) error.value = data.error;
	}

	function ensureEvaluation(nextEvaluationId: string) {
		if (evaluationId.value !== nextEvaluationId) {
			reset();
			evaluationId.value = nextEvaluationId;
		}
	}

	async function startRun(nextEvaluationId: string) {
		ensureEvaluation(nextEvaluationId);
		error.value = null;
		status.value = "running";
		try {
			const result = await runApi.startRun(nextEvaluationId);
			applyStatus(result);
			if (result.runId) {
				startPolling(result.runId);
			}
			return result;
		} catch (e) {
			status.value = "failed";
			error.value = "Unable to connect to target LLM.";
			throw e;
		}
	}

	async function fetchRunStatus(runIdToFetch: string) {
		const result = await runApi.fetchRunStatus(runIdToFetch);
		applyStatus(result);
		if (result.status === "completed" || result.status === "failed") {
			stopPolling();
		}
		return result;
	}

	function startPolling(runIdToFetch: string) {
		stopPolling();
		pollTimer = setInterval(() => {
			fetchRunStatus(runIdToFetch).catch(() => stopPolling());
		}, 2000);
	}

	function stopPolling() {
		if (pollTimer) {
			clearInterval(pollTimer);
			pollTimer = null;
		}
	}

	function reset() {
		stopPolling();
		evaluationId.value = null;
		runId.value = null;
		status.value = "idle";
		totalPrompts.value = 0;
		completedPrompts.value = 0;
		totalGenerations.value = 0;
		completedGenerations.value = 0;
		error.value = null;
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
		ensureEvaluation,
		startRun,
		fetchRunStatus,
		startPolling,
		stopPolling,
		reset,
	};
});
