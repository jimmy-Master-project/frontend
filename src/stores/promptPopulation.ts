import { defineStore } from "pinia";
import { computed, ref } from "vue";

import { createPoller } from "@/composables/usePolling";
import { formatApiError, parseApiError } from "@/services/api";
import { promptPopulationApi } from "@/services/promptPopulationApi";
import { useRunStore } from "@/stores/run";
import type {
	GenerationStatus,
	Prompt,
	PromptGenerationConfig,
	PromptPopulation,
	PromptPopulationSummary,
	RegenerateMode,
} from "@/types";

const IN_PROGRESS: GenerationStatus[] = ["pending", "generating"];

type PromptEditPayload = Pick<Prompt, "text" | "category">;

export const usePromptPopulationStore = defineStore("promptPopulation", () => {
	const currentEvaluationId = ref<string | null>(null);
	const population = ref<PromptPopulationSummary | null>(null);
	const prompts = ref<Prompt[]>([]);
	const generationStatus = ref<GenerationStatus>("idle");
	// Population currently being generated (for resuming the poll when the
	// user comes back to the page of the same evaluation).
	const activePopulationId = ref<number | null>(null);

	const loading = ref(false);
	const error = ref<string | null>(null);

	const promptCount = computed(() => prompts.value.length);
	const isGenerating = computed(() =>
		IN_PROGRESS.includes(generationStatus.value),
	);

	const categoryStats = computed(() => {
		const counts: Record<string, number> = {};
		for (const p of prompts.value) {
			const key = p.category || "Other";
			counts[key] = (counts[key] || 0) + 1;
		}
		return counts;
	});

	let pollTarget: { evaluationId: string; populationId: number } | null = null;
	const poller = createPoller<PromptPopulation>({
		fetch: () => {
			if (!pollTarget) throw new Error("No population to poll.");
			return promptPopulationApi.fetchPopulationStatus(pollTarget.populationId);
		},
		onResult: async (result) => {
			const target = pollTarget;
			if (!target || !isCurrent(target.evaluationId)) return true;
			return applyPopulationStatus(target.evaluationId, result);
		},
	});
	const connectionLost = poller.connectionLost;

	function isCurrent(evaluationId: string) {
		return currentEvaluationId.value === evaluationId;
	}

	/**
	 * Binds the store to an evaluation. Switching evaluation drops all state so
	 * nothing from the previous evaluation leaks into the next one.
	 */
	function ensureEvaluation(evaluationId: string | number) {
		const id = String(evaluationId);
		if (currentEvaluationId.value !== id) {
			reset();
			currentEvaluationId.value = id;
		}
		return id;
	}

	async function generatePopulation(
		evaluationId: string | number,
		config: PromptGenerationConfig,
		signal?: AbortSignal,
	) {
		return submitGeneration(evaluationId, signal, () =>
			promptPopulationApi.generate(String(evaluationId), config),
		);
	}

	async function regenerate(
		evaluationId: string | number,
		mode: RegenerateMode,
		config: PromptGenerationConfig,
		signal?: AbortSignal,
	) {
		return submitGeneration(evaluationId, signal, () =>
			promptPopulationApi.regenerate(String(evaluationId), mode, config),
		);
	}

	async function submitGeneration(
		evaluationId: string | number,
		signal: AbortSignal | undefined,
		request: () => ReturnType<typeof promptPopulationApi.generate>,
	) {
		const id = ensureEvaluation(evaluationId);
		if (isGenerating.value) return null;
		generationStatus.value = "pending";
		error.value = null;
		try {
			const accepted = await request();
			if (!isCurrent(id)) return accepted;
			useRunStore().reset();
			return beginTracking(id, accepted, signal);
		} catch (e) {
			if (!isCurrent(id)) throw e;
			// The backend explicitly reported failure (4xx/5xx with a body) — that is
			// authoritative and must not be papered over with a stale population.
			// Only fall back to "recover" when the request never got a response at
			// all (network drop, timeout, server restart), where a leftover
			// population may legitimately need re-fetching.
			if (parseApiError(e).isNetworkError) {
				const recovered = await recoverGeneratedPopulation(id);
				if (recovered) return recovered;
			}
			if (!isCurrent(id)) throw e;
			generationStatus.value = "failed";
			error.value = formatApiError(e, "Prompt generation failed.");
			throw e;
		}
	}

	// Generation runs one LLM call per prompt (or per persona for
	// counterfactual pairs) in a backend thread, so the POST above only
	// confirms the population was accepted -- the actual work can run well
	// past a typical HTTP timeout for larger populations. Poll until the
	// backend reports "completed" or "failed", same pattern as run polling.
	function beginTracking(
		evaluationId: string,
		accepted: PromptPopulation,
		signal?: AbortSignal,
	) {
		if (accepted.status === "failed") {
			generationStatus.value = "failed";
			error.value = "Prompt generation failed.";
			return accepted;
		}
		if (IN_PROGRESS.includes(accepted.status)) {
			generationStatus.value = accepted.status;
			activePopulationId.value = accepted.id;
			startPolling(evaluationId, accepted.id, signal);
		} else if (accepted.status === "completed") {
			void refreshCompleted(evaluationId);
		}
		return accepted;
	}

	function startPolling(
		evaluationId: string,
		populationId: number,
		signal?: AbortSignal,
	) {
		pollTarget = { evaluationId, populationId };
		poller.start(signal);
	}

	/**
	 * Resumes polling for a generation started earlier (e.g. the user left the
	 * page and came back). No-op when nothing is in progress.
	 */
	function resumeTracking(evaluationId: string | number, signal?: AbortSignal) {
		const id = String(evaluationId);
		if (!isCurrent(id) || !activePopulationId.value || !isGenerating.value) {
			return false;
		}
		startPolling(id, activePopulationId.value, signal);
		return true;
	}

	function stopPolling() {
		poller.stop();
	}

	async function applyPopulationStatus(
		evaluationId: string,
		result: PromptPopulation,
	) {
		if (IN_PROGRESS.includes(result.status)) {
			generationStatus.value = result.status;
			return false;
		}

		if (result.status === "failed") {
			generationStatus.value = "failed";
			activePopulationId.value = null;
			error.value = result.errorMessage || "Prompt generation failed.";
			return true;
		}

		// A failure here throws, which the poller retries with backoff.
		await refreshCompleted(evaluationId, true);
		return true;
	}

	async function refreshCompleted(evaluationId: string, rethrow = false) {
		try {
			const [summary, latestPrompts] = await Promise.all([
				promptPopulationApi.fetchPopulation(evaluationId),
				promptPopulationApi.fetchPrompts(evaluationId),
			]);
			if (!isCurrent(evaluationId)) return;
			population.value = summary;
			prompts.value = latestPrompts;
			generationStatus.value = "completed";
			activePopulationId.value = null;
			error.value = null;
		} catch (e) {
			if (rethrow) throw e;
		}
	}

	async function fetchPopulation(evaluationId: string | number) {
		const id = ensureEvaluation(evaluationId);
		loading.value = true;
		error.value = null;
		try {
			const summary = await promptPopulationApi.fetchPopulation(id);
			if (!isCurrent(id)) return;
			population.value = summary;
			// Pick up a generation that is still running (started before a page
			// reload or in another tab); resumeTracking() then polls it.
			if (summary.generatingPopulationId !== null && !isGenerating.value) {
				generationStatus.value = "generating";
				activePopulationId.value = summary.generatingPopulationId;
			}
		} catch (e) {
			if (isCurrent(id)) error.value = "Failed to load prompt population.";
			throw e;
		} finally {
			if (isCurrent(id)) loading.value = false;
		}
	}

	async function fetchPrompts(evaluationId: string | number) {
		const id = ensureEvaluation(evaluationId);
		loading.value = true;
		error.value = null;
		try {
			const latestPrompts = await promptPopulationApi.fetchPrompts(id);
			if (!isCurrent(id)) return;
			prompts.value = latestPrompts;
			if (prompts.value.length > 0 && !isGenerating.value) {
				generationStatus.value = "completed";
			}
		} catch (e) {
			if (isCurrent(id)) error.value = "Failed to load prompts.";
			throw e;
		} finally {
			if (isCurrent(id)) loading.value = false;
		}
	}

	function assertEditable() {
		if (isGenerating.value) {
			throw new Error("Prompts cannot be edited while the population is generating.");
		}
	}

	async function updatePrompt(
		evaluationId: string | number,
		promptId: string,
		payload: Partial<PromptEditPayload>,
	) {
		assertEditable();
		const id = String(evaluationId);
		const updated = await promptPopulationApi.updatePrompt(id, promptId, payload);
		if (!isCurrent(id)) return updated;
		const idx = prompts.value.findIndex((p) => p.id === promptId);
		if (idx !== -1) prompts.value[idx] = updated;
		return updated;
	}

	async function deletePrompt(evaluationId: string | number, promptId: string) {
		assertEditable();
		const id = String(evaluationId);
		await promptPopulationApi.deletePrompt(id, promptId);
		if (!isCurrent(id)) return;
		prompts.value = prompts.value.filter((p) => p.id !== promptId);
	}

	async function addPrompt(
		evaluationId: string | number,
		payload: PromptEditPayload,
	) {
		assertEditable();
		const id = String(evaluationId);
		const created = await promptPopulationApi.addPrompt(id, payload);
		if (isCurrent(id)) prompts.value.push(created);
		return created;
	}

	async function recoverGeneratedPopulation(evaluationId: string) {
		try {
			const [latestPopulation, latestPrompts] = await Promise.all([
				promptPopulationApi.fetchPopulation(evaluationId),
				promptPopulationApi.fetchPrompts(evaluationId),
			]);
			if (!isCurrent(evaluationId) || latestPrompts.length === 0) return null;
			population.value = latestPopulation;
			prompts.value = latestPrompts;
			generationStatus.value = "completed";
			error.value = null;
			return { summary: latestPopulation, prompts: latestPrompts };
		} catch {
			return null;
		}
	}

	function reset() {
		stopPolling();
		pollTarget = null;
		currentEvaluationId.value = null;
		activePopulationId.value = null;
		population.value = null;
		prompts.value = [];
		generationStatus.value = "idle";
		loading.value = false;
		error.value = null;
	}

	return {
		currentEvaluationId,
		population,
		prompts,
		generationStatus,
		isGenerating,
		connectionLost,
		loading,
		error,
		promptCount,
		categoryStats,
		ensureEvaluation,
		generatePopulation,
		regenerate,
		resumeTracking,
		stopPolling,
		fetchPopulation,
		fetchPrompts,
		updatePrompt,
		deletePrompt,
		addPrompt,
		reset,
	};
});
