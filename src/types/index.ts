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

export type Provider = "openai" | "evaair" | "virgin" | "finnair" | "chinaairlines" | "malaysia" | "philippine" | "vietjet" | "starlux" | "priceline";

export const PROVIDER_OPTIONS: Array<{ label: string; value: Provider; defaultBaseUrl: string; needsApiKey: boolean }> = [
	{ label: "OpenAI", value: "openai", defaultBaseUrl: "https://api.openai.com/v1", needsApiKey: true },
	// Served by the evaair-bot service (OpenAI-compatible) next to the backend.
	{ label: "EVA Air chatbot", value: "evaair", defaultBaseUrl: "http://127.0.0.1:8768/v1", needsApiKey: false },
	// Driven through a real browser by the browser-bots service.
	{ label: "Virgin Atlantic Concierge AI", value: "virgin", defaultBaseUrl: "http://127.0.0.1:8769/virgin/v1", needsApiKey: false },
	{ label: "Finnair Sisu", value: "finnair", defaultBaseUrl: "http://127.0.0.1:8769/finnair/v1", needsApiKey: false },
	{ label: "China Airlines AI 客服", value: "chinaairlines", defaultBaseUrl: "http://127.0.0.1:8769/chinaairlines/v1", needsApiKey: false },
	{ label: "Malaysia Airlines Mavis", value: "malaysia", defaultBaseUrl: "http://127.0.0.1:8769/malaysia/v1", needsApiKey: false },
	{ label: "Philippine Airlines myPAL", value: "philippine", defaultBaseUrl: "http://127.0.0.1:8769/philippine/v1", needsApiKey: false },
	{ label: "Vietjet Amy", value: "vietjet", defaultBaseUrl: "http://127.0.0.1:8769/vietjet/v1", needsApiKey: false },
	{ label: "星宇航空 AI Agent", value: "starlux", defaultBaseUrl: "http://127.0.0.1:8769/starlux/v1", needsApiKey: false },
	// Priceline Penny HTTP API, wrapped by the priceline-bot service.
	{ label: "Priceline Penny", value: "priceline", defaultBaseUrl: "http://127.0.0.1:8770/v1", needsApiKey: false },
];

/** Prompt Generation Agent providers (backend prompt_agents); the EVA Air bot cannot write prompts. */
export type PromptAgentProvider = "openai_compatible" | "openai";

export const PROMPT_AGENT_PROVIDER_OPTIONS: Array<{ label: string; value: PromptAgentProvider }> = [
	{ label: "OpenAI Compatible", value: "openai_compatible" },
	{ label: "OpenAI", value: "openai" },
];

export function needsApiKey(provider: Provider): boolean {
	return PROVIDER_OPTIONS.find((option) => option.value === provider)?.needsApiKey ?? true;
}

export function defaultBaseUrl(provider: Provider): string {
	return PROVIDER_OPTIONS.find((option) => option.value === provider)?.defaultBaseUrl ?? "";
}

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
	/** Target LLM description: the initial prompt agent's "requirement document". */
	useCaseDescription: string;
	taskType: TaskType;
	language: EvaluationLanguage;
	classificationLabels?: ClassificationLabel[];
  recommendationItems?: RecommendationItem[];
  /** User-defined test directions (seed tasks) the initial prompt agent expands. */
  testDirections?: string[];
  taskObjectives?: TaskObjective[];
	status: EvaluationStatus;
	promptCount: number;
	createdAt: string;
}

export interface TaskObjective {
	objective: string;
	// Set when the objective came from the initial prompt agent (test plan).
	// Stored as an internal JSON blob, so the keys stay snake_case.
	/** The user-defined test direction this objective expands, and its 1-based number. */
	test_direction?: string;
	/** Label of the question-expansion strategy, for imported directions. */
	strategy?: string;
	test_direction_index?: number;
	technique?: TestTechnique;
	helm_scenario?: HelmScenario;
	bias_risk?: BiasRisk;
	why_identity_could_matter?: string;
	is_control?: boolean;
}

/* ---------- Initial prompt agent (test plan) ---------- */

export type TestTechnique =
	| "equivalence_partitioning"
	| "boundary_value"
	| "decision_table"
	| "state_transition"
	| "combinatorial"
	| "error_guessing";

export type BiasRisk =
	| "counterfactual_fairness"
	| "performance_disparity"
	| "stereotypical_association"
	| "control";

export type TestPlanProtectedAttribute = "gender" | "race_ethnicity";

export interface HelmScenario {
	what: string;
	who: string;
	when: string;
}

export interface TestPlanDirection extends TaskObjective {
	test_direction: string;
	test_direction_index: number;
	technique: TestTechnique;
	helm_scenario: HelmScenario;
	bias_risk: BiasRisk;
	why_identity_could_matter: string;
	is_control: boolean;
}

export interface TestPlanTechnique {
	technique: TestTechnique;
	rationale: string;
	/** 1-based numbers of the test directions this technique applies to. */
	test_directions?: number[];
	coverage_focus: string[];
	direction_count: number;
}

export interface TestPlanRejected {
	objective?: string;
	technique: string;
	reason: string;
}

/** Coverage of test directions (rows) x HELM "when" stages (columns). */
export interface TestPlanCoverage {
	test_directions: string[];
	when: string[];
	filled_cells: number;
	total_cells: number;
	cell_coverage: number;
	by_test_direction: number[];
	uncovered_test_directions: string[];
	by_technique: Record<string, number>;
	by_bias_risk: Record<string, number>;
	control_count: number;
}

/** Optional extras added to the target LLM description for this plan. */
export interface TestPlanTargetInfo {
	knownPolicies: string;
	systemPromptExcerpt: string;
	userPopulation: string;
	riskPriorities: string;
	/** HELM "when" stages (snake_case); blank uses the airline defaults. */
	whenStages: string[];
}

export interface TestPlanRequest {
	provider?: string;
	modelName?: string;
	baseUrl?: string;
	temperature?: number;
	targetInfo?: Partial<TestPlanTargetInfo>;
	protectedAttributes?: TestPlanProtectedAttribute[];
	totalDirections?: number;
	apply?: boolean;
}

export interface TestPlanGapFill {
	/** Test directions that had no question direction after Step 2. */
	targeted: string[];
	/** Objectives added for those test directions. */
	added: string[];
}

export interface TestPlan {
	evaluationId: number;
	applied: boolean;
	strategySummary: string;
	protectedAttributes: TestPlanProtectedAttribute[];
	targetInfo: Record<string, unknown>;
	testDirections: string[];
	techniques: TestPlanTechnique[];
	directions: TestPlanDirection[];
	rejected: TestPlanRejected[];
	coverage: TestPlanCoverage;
	gapFill?: TestPlanGapFill;
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
	/** The only attributes a fairness label may use (LangFair-supported). */
	protectedAttributes?: ProtectedAttribute[];
}

/** A LangFair-supported fairness attribute backed by one persona dimension. */
export interface ProtectedAttribute {
	/** Persona dimension key, e.g. gender_identity. */
	key: string;
	/** LangFair attribute: "gender" | "race". */
	attribute: string;
	label: string;
	/** Whether counterfactual prompt pairs are generated for it. */
	counterfactual: boolean;
	/** LangFair groups and the persona values that map onto each. */
	groups: Array<{ name: string; values: string[] }>;
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
	/** Hand-picked persona ids; when non-empty they replace random sampling. */
	personaIds?: string[];
	/** UI only: "pick" = hand-picked personas, "set" = a saved persona list. */
	personaSource?: "sample" | "pick" | "set";
	/** Saved persona list the personaIds came from (personaSource "set"). */
	personaSetId?: number | null;

}

/** A saved persona list (GET /persona/sets/). */
export interface PersonaSet {
	id: number;
	name: string;
	pool: string;
	/** Conditions it was drawn with; keys are persona attribute names (data). */
	filters: Record<string, string[]>;
	requestedSize: number;
	size: number;
	seed: number;
	personaIds: string[];
	createdAt: string | null;
	/** Only on detail / create responses. */
	personas?: PersonaPreview[];
}

/** One row of GET /persona/personas (browse list). */
export interface PersonaCard {
	personaId: string;
	name: string;
	source: string;
	/** A few headline dimensions (data keys). */
	summary: Record<string, string>;
	/** Flat "key value …" text of every attribute, for client-side search. */
	searchText: string;
}

/** Persona config as stored on a generated population (summary endpoint). */
export interface PopulationPersonaConfig extends PersonaConfig {
	personaSetName?: string;
	uniquePersonaCount?: number | null;
	reusedPersonas?: boolean;
}

/** POST /evaluations/{id}/prompt-population/generate body. */
export interface PromptGenerationConfig {
	provider: PromptAgentProvider;
	modelName: string;
	promptCount: number;
	temperature: number;
	additionalInstruction?: string;
	persona?: PersonaConfig;
	/** Without personas: pair each prompt as "I'm a woman. …" / "I'm a man. …". */
	counterfactualTemplate?: boolean;
	/** Experiment condition label of the new population. */
	name?: string;
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
	/** Experiment condition label (editable), e.g. "G4 Proposed". */
	name?: string;
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
	/** persona_counterfactual_word_swap, persona_conditioned_generation, template_counterfactual or "" (plain). */
	generationMode?: string;
	/** Generation cost; empty for populations generated before it was recorded. */
	generationStats?: { llmCalls?: number; seconds?: number; startedAt?: string; finishedAt?: string };
	createdAt?: string | null;
	/** Request that generated it (null for populations from before this was recorded). */
	generationRequest?: Partial<PromptGenerationConfig> | null;
	/** Question directions the evaluation had when it was generated. */
	taskObjectives?: string[] | null;
	/** The evaluation's stored objectives at that time (with test-plan details). */
	taskObjectivesRaw?: TaskObjective[] | null;
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
	/** Optional system message before every prompt (bias injection); empty = none. */
	systemPrompt?: string;
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
	/** Run created outside the normal flow (e.g. an external bot). */
	external: boolean;
	startedAt?: string | null;
	finishedAt?: string | null;
	/** Name shown in the run history (e.g. the flow node that started it). */
	label?: string;
	/** Target LLM settings the run used (empty for runs before history existed). */
	llmSnapshot?: RunLlmSnapshot;
	promptPopulationId?: number;
	/** Experiment condition of the population this run sent. */
	condition?: RunCondition;
}

export interface RunCondition {
	populationName: string;
	personaBased: boolean;
	personaSetName: string;
	generationMode: string;
	/** null for populations generated before directions were recorded. */
	objectiveCount: number | null;
	/** Strategy labels of imported question directions. */
	directionStrategies: string[];
}

export interface RunLlmSnapshot {
	provider?: string;
	modelName?: string;
	baseUrl?: string;
	temperature?: number;
	topP?: number;
	maxTokens?: number;
	generationsPerPrompt?: number;
	/** Non-empty when the run injected a system prompt (e.g. a planted bias). */
	systemPrompt?: string;
	external?: boolean;
}

/** One row of GET /runs/{id}/responses/. */
export interface RunResponseRecord {
	id: number;
	prompt: { id: number; text: string; category: string };
	generationIndex: number;
	responseText: string;
	inputTokens: number | null;
	outputTokens: number | null;
	latencyMs: number | null;
	error: string | null;
	createdAt: string;
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
	/** ASCII-letter-ratio check; every suite of the run is refused when false. */
	languageCheck?: LangFairLanguageCheck;
}

export interface LangFairLanguageCheck {
	isEnglish: boolean;
	method: string;
	asciiRatioThreshold: number;
	checkedResponseCount: number;
	nonEnglishResponseCount: number;
	nonEnglishResponseIds: Array<number | string>;
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
