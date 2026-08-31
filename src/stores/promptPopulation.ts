import { defineStore } from "pinia";
import { computed, ref } from "vue";

import { promptPopulationApi } from "@/services/promptPopulationApi";
import { useRunStore } from "@/stores/run";
import type {
	GenerationStatus,
	Prompt,
	PromptGenerationConfig,
	PromptPopulationSummary,
	RegenerateMode,
} from "@/types";

export const usePromptPopulationStore = defineStore("promptPopulation", () => {
	const population = ref<PromptPopulationSummary | null>(null);
	const prompts = ref<Prompt[]>([]);
	const generationStatus = ref<GenerationStatus>("idle");

	const loading = ref(false);
	const error = ref<string | null>(null);

	const promptCount = computed(() => prompts.value.length);

	const categoryStats = computed(() => {
		const counts: Record<string, number> = {};
		for (const p of prompts.value) {
			const key = p.category || "Other";
			counts[key] = (counts[key] || 0) + 1;
		}
		return counts;
	});

	let pollTimer: ReturnType<typeof setInterval> | null = null;

	async function generatePopulation(
		evaluationId: string,
		config: PromptGenerationConfig,
	) {
		generationStatus.value = "generating";
		error.value = null;
		try {
			const accepted = await promptPopulationApi.generate(evaluationId, config);
			useRunStore().reset();
			return beginTracking(evaluationId, accepted);
		} catch (e) {
			// The backend explicitly reported failure (4xx/5xx with a body) — that is
			// authoritative and must not be papered over with a stale population.
			// Only fall back to "recover" when the request never got a response at
			// all (network drop, timeout, aborted request, server restart), where a
			// leftover in-progress population may legitimately need re-fetching.
			if (!hasServerResponse(e)) {
				const recovered = await recoverGeneratedPopulation(evaluationId);
				if (recovered) return recovered;
			}
			generationStatus.value = "failed";
			error.value = formatGenerationError(e);
			throw e;
		}
	}

	async function regenerate(
		evaluationId: string,
		mode: RegenerateMode,
		config: PromptGenerationConfig,
	) {
		generationStatus.value = "generating";
		error.value = null;
		try {
			const accepted = await promptPopulationApi.regenerate(
				evaluationId,
				mode,
				config,
			);
			useRunStore().reset();
			return beginTracking(evaluationId, accepted);
		} catch (e) {
			if (!hasServerResponse(e)) {
				const recovered = await recoverGeneratedPopulation(evaluationId);
				if (recovered) return recovered;
			}
			generationStatus.value = "failed";
			error.value = formatGenerationError(e);
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
		accepted: { populationId: string; status: GenerationStatus },
	) {
		if (accepted.status === "failed") {
			generationStatus.value = "failed";
			error.value = "Prompt generation failed.";
			return accepted;
		}
		if (accepted.status === "generating") {
			startPolling(evaluationId, accepted.populationId);
		}
		return accepted;
	}

	function startPolling(evaluationId: string, populationId: string) {
		stopPolling();
		pollTimer = setInterval(() => {
			pollPopulationStatus(evaluationId, populationId).catch(() => {
				stopPolling();
				generationStatus.value = "failed";
				error.value = "Lost connection while generating the prompt population.";
			});
		}, 2000);
	}

	function stopPolling() {
		if (pollTimer) {
			clearInterval(pollTimer);
			pollTimer = null;
		}
	}

	async function pollPopulationStatus(evaluationId: string, populationId: string) {
		const result = await promptPopulationApi.fetchPopulationStatus(populationId);
		if (result.status === "generating") return;

		stopPolling();
		if (result.status === "failed") {
			generationStatus.value = "failed";
			error.value = result.errorMessage || "Prompt generation failed.";
			return;
		}

		const [summary, latestPrompts] = await Promise.all([
			promptPopulationApi.fetchPopulation(evaluationId),
			promptPopulationApi.fetchPrompts(evaluationId),
		]);
		population.value = summary;
		prompts.value = latestPrompts;
		generationStatus.value = "completed";
		error.value = null;
	}

	function hasServerResponse(e: unknown) {
		return Boolean((e as { response?: unknown } | null)?.response);
	}

	async function fetchPopulation(evaluationId: string) {
		loading.value = true;
		error.value = null;
		try {
			population.value = await promptPopulationApi.fetchPopulation(evaluationId);
		} catch (e) {
			error.value = "Failed to load prompt population.";
			throw e;
		} finally {
			loading.value = false;
		}
	}

	async function fetchPrompts(evaluationId: string) {
		loading.value = true;
		error.value = null;
		try {
			prompts.value = await promptPopulationApi.fetchPrompts(evaluationId);
			if (prompts.value.length > 0) {
				generationStatus.value = "completed";
			}
		} catch (e) {
			error.value = "Failed to load prompts.";
			throw e;
		} finally {
			loading.value = false;
		}
	}

	async function updatePrompt(
		evaluationId: string,
		promptId: string,
		payload: Partial<Pick<Prompt, "prompt" | "category">>,
	) {
		const updated = await promptPopulationApi.updatePrompt(
			evaluationId,
			promptId,
			payload,
		);
		const idx = prompts.value.findIndex((p) => p.id === promptId);
		if (idx !== -1) prompts.value[idx] = updated;
		return updated;
	}

	async function deletePrompt(evaluationId: string, promptId: string) {
		await promptPopulationApi.deletePrompt(evaluationId, promptId);
		prompts.value = prompts.value.filter((p) => p.id !== promptId);
	}

	async function addPrompt(
		evaluationId: string,
		payload: Pick<Prompt, "prompt" | "category">,
	) {
		const created = await promptPopulationApi.addPrompt(evaluationId, payload);
		prompts.value.push(created);
		return created;
	}

	async function recoverGeneratedPopulation(evaluationId: string) {
		try {
			const [latestPopulation, latestPrompts] = await Promise.all([
				promptPopulationApi.fetchPopulation(evaluationId),
				promptPopulationApi.fetchPrompts(evaluationId),
			]);
			if (latestPrompts.length === 0) return null;
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
		population.value = null;
		prompts.value = [];
		generationStatus.value = "idle";
		error.value = null;
	}

	function formatGenerationError(e: unknown) {
		const response = (e as { response?: { data?: unknown } }).response;
		const data = response?.data as
			| { error?: string; message?: string; [key: string]: unknown }
			| undefined;
		const code = data?.error;
		if (code === "matraix_unavailable")
			return "Persona service is currently unavailable.";
		if (code === "no_personas_matched")
			return "No personas matched the selected filters.";
		if (code === "invalid_filters") return "Invalid persona filters.";
		if (code === "missing_attributes")
			return "Selected persona attributes are unavailable.";
		// The backend puts the real, human-readable failure reason in `message`
		// on some error paths and `error` on others (there is no single
		// consistent field) -- surface whichever is present instead of always
		// falling through to a generic string that hides the actual reason.
		if (data?.message) return data.message;
		if (typeof code === "string" && code) return code;
		const fieldError = extractDrfFieldError(data);
		if (fieldError) return fieldError;
		return "Prompt generation failed.";
	}

	function extractDrfFieldError(data: unknown): string | null {
		if (!data || typeof data !== "object") return null;
		for (const value of Object.values(data as Record<string, unknown>)) {
			if (Array.isArray(value) && typeof value[0] === "string") return value[0];
			if (typeof value === "string") return value;
		}
		return null;
	}

	return {
		population,
		prompts,
		generationStatus,
		loading,
		error,
		promptCount,
		categoryStats,
		generatePopulation,
		regenerate,
		fetchPopulation,
		fetchPrompts,
		updatePrompt,
		deletePrompt,
		addPrompt,
		reset,
	};
});
