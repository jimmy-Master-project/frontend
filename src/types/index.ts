export type TaskType =
	| "text_generation"
	| "classification"
	| "recommendation"
 	| "other";

/** Matches backend Evaluation.Language choices. */
export type EvaluationLanguage = "en" | "auto";

export const TASK_TYPE_OPTIONS: Array<{ label: string; value: TaskType }> = [
	{ label: "Text Generation", value: "text_generation" },
	{ label: "Classification", value: "classification" },
	{ label: "Recommendation", value: "recommendation" },
	{ label: "Other", value: "other" },
];

export type EvaluationStatus =
	| "draft"
	| "generating_prompts"
	| "prompt_ready"
	| "ready"
	| "running"
	| "completed"
	| "failed";

export type Provider = "openai_compatible" | "openai" | "gemini" | "custom";

export const PROVIDER_OPTIONS: Array<{ label: string; value: Provider }> = [
	{ label: "OpenAI Compatible", value: "openai_compatible" },
	{ label: "OpenAI", value: "openai" },
	{ label: "Gemini", value: "gemini" },
	{ label: "Custom", value: "custom" },
];

export interface ClassificationLabel {
	value: number;
	name: string;
	description?: string;
}

export interface RecommendationItem {
	name: string;
	description?: string;
}

export interface Evaluation {
	id: string;
	name: string;
	useCaseDescription: string;
	taskType: TaskType;
	language: EvaluationLanguage;
	classificationLabels?: ClassificationLabel[];
  recommendationItems?: RecommendationItem[];
  taskObjectives?: TaskObjective[];
	status: EvaluationStatus;
	promptCount: number;
	createdAt: string;
}

export interface TaskObjective {
	 objective: string;
}

/** GET /persona/attributes item (normalized from the MatrAIx catalog by the backend). */
export interface PersonaAttribute {
	key: string;
	label?: string;
	category?: string;
	description?: string;
	values?: string[];
}

export interface PersonaCatalog {
	pool?: string;
	attributes: PersonaAttribute[];
}

export interface PersonaPreview {
	personaId: string;
	/** Keyed by MatrAIx dimension name (data keys, not camelCased). */
	attributes: Record<string, string>;
	missingAttributes: string[];
}

export interface PersonaConfig {
	enabled: boolean;
	pool?: string;
	selectedAttributes: string[];
	/** Keyed by persona attribute name (data keys, not camelCased). */
	filters: Record<string, string[]>;
	stratify: string | null;
	/** `null` means "random": a fresh seed is drawn when generating/previewing. */
	seed: number | null;
	counterfactualEnabled?: boolean;
}

/** Persona config as stored on a generated population (summary endpoint). */
export interface PopulationPersonaConfig extends PersonaConfig {
	uniquePersonaCount?: number | null;
	reusedPersonas?: boolean;
}

/** POST /evaluations/{id}/prompt-population/generate body. */
export interface PromptGenerationConfig {
	provider: Provider;
	modelName: string;
	promptCount: number;
	temperature: number;
	additionalInstruction?: string;
	persona?: PersonaConfig;
}

export interface PromptFairnessMetadata {
	task?: string;
	attribute?: string;
	sourceAttribute?: string;
	group?: string;
	pairId?: string;
	role?: "original" | "counterfactual" | string;
	sourcePersonaId?: string;
	objectiveIndex?: number;
}

export interface Prompt {
	id: string;
	index: number;
	text: string;
	category: string;
	personaId?: string | null;
	/** Keyed by persona attribute name (data keys, not camelCased). */
	personaAttributes?: Record<string, string>;
	missingAttributes?: string[];
	fairness?: PromptFairnessMetadata;
}

export type RegenerateMode = "replace" | "additional";

/** GET /evaluations/{id}/prompt-population: the population whose prompts are listed. */
export interface PromptPopulationSummary {
	populationId: number | null;
	status: PopulationStatus | null;
	errorMessage: string;
	generationModel: string;
	provider: string;
	temperature: number;
	requested: number;
	generated: number;
	personaBased: boolean;
	persona: PopulationPersonaConfig | null;
	personaAttributes: string[];
	stratifiedBy: string | null;
	seed: number | null;
	fairness: Record<string, unknown>;
	/** Newest population still generating (possibly newer than `populationId`). */
	generatingPopulationId: number | null;
}

/** GET /prompt-populations/{id} (also the 202 body of the generate endpoint). */
export interface PromptPopulation {
	id: number;
	evaluationId: number;
	name: string;
	provider: string;
	modelName: string;
	temperature: number;
	requestedPromptCount: number;
	actualPromptCount: number;
	additionalInstruction: string;
	/** Raw internal JSON blob (snake_case keys). */
	metadata: Record<string, unknown>;
	status: PopulationStatus;
	errorMessage: string;
	createdAt: string;
}

export type PopulationStatus = "pending" | "generating" | "completed" | "failed";

export type GenerationStatus = "idle" | PopulationStatus;

export interface LLMConfig {
	provider: Provider;
	modelName: string;
	baseUrl: string;
	apiKey?: string;
	temperature: number;
	topP: number;
	maxTokens: number;
	generationsPerPrompt: number;
}

export type RunState = "idle" | "pending" | "running" | "completed" | "failed";

/** GET /runs/{id}/status (also the 201 body of POST /evaluations/{id}/runs). */
export interface RunStatus {
	id: number;
	status: Exclude<RunState, "idle">;
	totalPrompts: number;
	completedPrompts: number;
	totalGenerations: number;
	completedGenerations: number;
	/** 0..1 */
	progress: number;
	errorMessage: string;
	heartbeatAt: string | null;
	/** Generations that failed after retries (completedGenerations counts successes only). */
	failedGenerations: number;
	/** Run created outside the normal flow (e.g. benchmark); cannot be resumed. */
	external: boolean;
}

export interface LangFairMetricsResult {
	runId: string | number | null;
	responseCount: number;
	availableSuites: string[];
	selectedSuites?: string[];
	taskType?: TaskType | string;
	suites: Record<string, unknown>;
	/** Status of the async metric computation. */
	status?: LangFairComputationStatus;
	/** Status of the run the metrics were computed from. */
	runStatus?: RunState | string;
	/** True when computed from a run that has not completed all generations. */
	partial?: boolean;
	error?: string;
	computedAt?: string;
	excludedResponseCount?: number;
	language?: string;
}

export type LangFairComputationStatus = "none" | "running" | "completed" | "failed";

export interface ResponseItem {
	id: string;
	promptId: string;
	promptIndex: number;
	promptText: string;
	promptCategory: string;
	response: string;
	generationIndex: number;
	model: string;
	inputTokens: number;
	outputTokens: number;
	latencyMs: number;
	/** Set when generation failed after retries (response is empty). */
	error?: string | null;
}

export interface ResponseFilters {
	category: string | null;
	generationIndex: number | null;
	keyword: string;
}
