import api from "./api";
import type {
	GenerationStatus,
	Prompt,
	PromptGenerationConfig,
	PromptPopulationSummary,
	RegenerateMode,
} from "@/types";

export interface GenerateAcceptedResult {
	populationId: string;
	status: GenerationStatus;
	requestedPromptCount: number;
}

export interface PopulationStatusResult {
	populationId: string;
	status: GenerationStatus;
	requestedPromptCount: number;
	generatedCount: number;
	errorMessage: string | null;
}

type RawPrompt = Partial<Prompt> & {
	text?: string;
	sequence?: number;
	personaId?: string | null;
	personaAttributes?: Record<string, string>;
	missingAttributes?: string[];
	fairness?: Prompt["fairness"];
	metadata?: Record<string, unknown>;
};

type RawSummary = Partial<PromptPopulationSummary> & {
	generation_model?: string;
	model_name?: string;
	requested_prompt_count?: number;
	actual_prompt_count?: number;
	persona_based?: boolean;
	persona_attributes?: string[];
	stratified_by?: string | null;
	subgroup_counts?: Record<string, Record<string, number>>;
	fairness?: Record<string, unknown>;
};

function normalizePrompt(raw: RawPrompt, index: number): Prompt {
	const metadata = raw.metadata || {};
	const personaAttributes =
		raw.persona_attributes ||
		raw.personaAttributes ||
		(metadata.persona_attributes as Record<string, string> | undefined);
	return {
		id: String(raw.id ?? index + 1),
		index: raw.index ?? raw.sequence ?? index + 1,
		prompt: raw.prompt ?? raw.text ?? "",
		category: raw.category ?? "",
		persona_id:
			raw.persona_id ??
			raw.personaId ??
			(metadata.persona_id as string | null | undefined) ??
			null,
		persona_attributes: personaAttributes,
		missing_attributes:
			raw.missing_attributes ||
			raw.missingAttributes ||
			(metadata.missing_attributes as string[] | undefined),
		fairness:
			raw.fairness || (metadata.fairness as Prompt["fairness"] | undefined),
	};
}

function normalizeSummary(raw: RawSummary = {}): PromptPopulationSummary {
	return {
		generationModel:
			raw.generationModel ?? raw.generation_model ?? raw.model_name ?? "",
		temperature: raw.temperature ?? 0,
		requested: raw.requested ?? raw.requested_prompt_count ?? 0,
		generated: raw.generated ?? raw.actual_prompt_count ?? 0,
		personaBased:
			raw.personaBased ?? raw.persona_based ?? raw.persona?.enabled ?? false,
		persona: raw.persona ?? null,
		personaAttributes:
			raw.personaAttributes ??
			raw.persona_attributes ??
			raw.persona?.selected_attributes,
		stratifiedBy:
			raw.stratifiedBy ?? raw.stratified_by ?? raw.persona?.stratify ?? null,
		seed: raw.seed ?? raw.persona?.seed ?? null,
		subgroupCounts: raw.subgroupCounts ?? raw.subgroup_counts,
		fairness: raw.fairness,
	};
}

interface RawGenerateAccepted {
	population_id: number | string;
	status: GenerationStatus;
	requested_prompt_count?: number;
}

function normalizeGenerateAccepted(data: RawGenerateAccepted): GenerateAcceptedResult {
	return {
		populationId: String(data.population_id),
		status: data.status,
		requestedPromptCount: data.requested_prompt_count ?? 0,
	};
}

interface RawPopulationStatus {
	id: number | string;
	status: GenerationStatus;
	requested_prompt_count?: number;
	actual_prompt_count?: number;
	error_message?: string | null;
}

function normalizePopulationStatus(data: RawPopulationStatus): PopulationStatusResult {
	return {
		populationId: String(data.id),
		status: data.status,
		requestedPromptCount: data.requested_prompt_count ?? 0,
		generatedCount: data.actual_prompt_count ?? 0,
		errorMessage: data.error_message || null,
	};
}

function buildGenerationPayload(config: PromptGenerationConfig) {
	return {
		...config,
		prompt_count: config.promptCount,
		population_size: config.promptCount,
		additional_instruction: config.additionalInstructions,
		persona: config.persona?.enabled
			? {
					enabled: true,
					pool: config.persona.pool,
					selected_attributes: config.persona.selected_attributes,
					filters: config.persona.filters,
					stratify: config.persona.stratify,
					seed: config.persona.seed,
					counterfactual_enabled: config.persona.counterfactual_enabled ?? false,
				}
			: { enabled: false },
	};
}

export const promptPopulationApi = {
	// Generation runs one LLM call per prompt (or per persona for
	// counterfactual pairs) in a backend thread, so it returns immediately with
	// status "generating" -- the actual work can run well past a typical HTTP
	// timeout for larger populations. Callers must poll fetchPopulationStatus
	// until it reports "completed" or "failed".
	generate(evaluationId: string, config: PromptGenerationConfig) {
		return api
			.post<RawGenerateAccepted>(
				`/evaluations/${evaluationId}/prompt-population/generate`,
				buildGenerationPayload(config),
			)
			.then((res) => normalizeGenerateAccepted(res.data));
	},
	regenerate(
		evaluationId: string,
		_mode: RegenerateMode,
		config: PromptGenerationConfig,
	) {
		// Backend generation endpoint always creates a fresh PromptPopulation.
		// Use the same endpoint for regeneration so we never reuse an older population.
		return api
			.post<RawGenerateAccepted>(
				`/evaluations/${evaluationId}/prompt-population/generate`,
				buildGenerationPayload(config),
			)
			.then((res) => normalizeGenerateAccepted(res.data));
	},
	fetchPopulationStatus(populationId: string) {
		return api
			.get<RawPopulationStatus>(`/prompt-populations/${populationId}/`)
			.then((res) => normalizePopulationStatus(res.data));
	},
	fetchPopulation(evaluationId: string) {
		return api
			.get(`/evaluations/${evaluationId}/prompt-population`)
			.then((res) => normalizeSummary(res.data));
	},
	fetchPrompts(evaluationId: string) {
		return api
			.get<RawPrompt[]>(`/evaluations/${evaluationId}/prompts`)
			.then((res) => res.data.map(normalizePrompt));
	},
	updatePrompt(
		evaluationId: string,
		promptId: string,
		payload: Partial<Pick<Prompt, "prompt" | "category">>,
	) {
		return api
			.patch<RawPrompt>(
				`/evaluations/${evaluationId}/prompts/${promptId}`,
				payload,
			)
			.then((res) => normalizePrompt(res.data, 0));
	},
	deletePrompt(evaluationId: string, promptId: string) {
		return api
			.delete(`/evaluations/${evaluationId}/prompts/${promptId}`)
			.then((res) => res.data);
	},
	addPrompt(evaluationId: string, payload: Pick<Prompt, "prompt" | "category">) {
		return api
			.post<RawPrompt>(`/evaluations/${evaluationId}/prompts`, payload)
			.then((res) => normalizePrompt(res.data, 0));
	},
};
