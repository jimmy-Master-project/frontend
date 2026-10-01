import api from "./api";
import type {
	Prompt,
	PromptGenerationConfig,
	PromptPopulation,
	PromptPopulationSummary,
	RegenerateMode,
} from "@/types";

type PromptEditPayload = Pick<Prompt, "text" | "category">;

function buildGenerationPayload(config: PromptGenerationConfig) {
	return {
		...config,
		persona: config.persona?.enabled ? config.persona : { enabled: false },
	};
}

export const promptPopulationApi = {
	// Generation runs one LLM call per prompt (or per persona for
	// counterfactual pairs) in a backend thread, so it returns immediately (202)
	// with status "generating" -- the actual work can run well past a typical
	// HTTP timeout for larger populations. Callers must poll
	// fetchPopulationStatus until it reports "completed" or "failed".
	generate(evaluationId: string, config: PromptGenerationConfig) {
		return api
			.post<PromptPopulation>(
				`/evaluations/${evaluationId}/prompt-population/generate`,
				buildGenerationPayload(config),
			)
			.then((res) => res.data);
	},
	regenerate(
		evaluationId: string,
		_mode: RegenerateMode,
		config: PromptGenerationConfig,
	) {
		// Backend generation endpoint always creates a fresh PromptPopulation.
		// Use the same endpoint for regeneration so we never reuse an older population.
		return promptPopulationApi.generate(evaluationId, config);
	},
	fetchPopulationStatus(populationId: number) {
		return api
			.get<PromptPopulation>(`/prompt-populations/${populationId}/`)
			.then((res) => res.data);
	},
	fetchPopulation(evaluationId: string) {
		return api
			.get<PromptPopulationSummary>(`/evaluations/${evaluationId}/prompt-population`)
			.then((res) => res.data);
	},
	fetchPrompts(evaluationId: string) {
		return api
			.get<Prompt[]>(`/evaluations/${evaluationId}/prompts`)
			.then((res) => res.data);
	},
	updatePrompt(
		evaluationId: string,
		promptId: string,
		payload: Partial<PromptEditPayload>,
	) {
		return api
			.patch<Prompt>(`/evaluations/${evaluationId}/prompts/${promptId}`, payload)
			.then((res) => res.data);
	},
	deletePrompt(evaluationId: string, promptId: string) {
		return api
			.delete(`/evaluations/${evaluationId}/prompts/${promptId}`)
			.then((res) => res.data);
	},
	addPrompt(evaluationId: string, payload: PromptEditPayload) {
		return api
			.post<Prompt>(`/evaluations/${evaluationId}/prompts`, payload)
			.then((res) => res.data);
	},
};
