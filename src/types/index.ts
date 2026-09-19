export type TaskType =
	| "text_generation"
	| "classification"
	| "recommendation"
 	| "other";

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

export interface PersonaAttribute {
	key: string;
	label?: string;
	category?: string;
	description?: string;
	values?: string[];
	allowedValues?: string[];
	type?: string;
	freeText?: boolean;
}

export interface PersonaCatalog {
	attributes: PersonaAttribute[];
	pool?: string;
	sampleSizeMin?: number;
	sampleSizeMax?: number;
	previewSizeMax?: number;
}

export interface PersonaPreview {
	persona_id: string;
	attributes: Record<string, string>;
	missing_attributes: string[];
}

export interface PersonaConfig {
	enabled: boolean;
	pool?: string;
	selected_attributes: string[];
	filters: Record<string, string[]>;
	stratify: string | null;
	seed: number;
	counterfactual_enabled?: boolean;
}

export interface PromptGenerationConfig {
	provider: Provider;
	model: string;
	promptCount: number;
	temperature: number;
	additionalInstructions?: string;
	persona?: PersonaConfig;
}

export interface PromptFairnessMetadata {
	task?: string;
	attribute?: string;
	group?: string;
	pair_id?: string;
	role?: "original" | "counterfactual" | string;
	source_persona_id?: string;
}

export interface Prompt {
	id: string;
	index: number;
	prompt: string;
	category: string;
	persona_id?: string | null;
	persona_attributes?: Record<string, string>;
	missing_attributes?: string[];
	fairness?: PromptFairnessMetadata;
}

export type RegenerateMode = "replace" | "additional";

export interface PromptPopulationSummary {
	generationModel: string;
	temperature: number;
	requested: number;
	generated: number;
	personaBased?: boolean;
	persona?: PersonaConfig | null;
	personaAttributes?: string[];
	stratifiedBy?: string | null;
	seed?: number | null;
	subgroupCounts?: Record<string, Record<string, number>>;
	fairness?: Record<string, unknown>;
}

export type GenerationStatus = "idle" | "generating" | "completed" | "failed";

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

export type RunState = "idle" | "running" | "completed" | "failed";

export interface RunStatus {
	runId: string | null;
	status: RunState;
	totalPrompts: number;
	completedPrompts: number;
	totalGenerations: number;
	completedGenerations: number;
	error: string | null;
}

export interface ClassificationOutput {
	model: string;
	predictions: Record<string, number>;
	latencyMs: number;
	error: string | null;
}

export interface LangFairMetricsResult {
	runId: string | number | null;
	responseCount: number;
	availableSuites: string[];
	selectedSuites?: string[];
	taskType?: TaskType | string;
	suites: Record<string, unknown>;
}

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
	classifications: Record<string, ClassificationOutput>;
}

export interface ClassificationLabelSummary {
	average: number;
	max: number;
	flaggedCount: number;
}

export interface ClassifierSummary {
	model: string;
	total: number;
	failed: number;
	highRiskCount: number;
	labels: Record<string, ClassificationLabelSummary>;
}

export interface ClassificationSummary {
	threshold: number;
	classifiers: Record<string, ClassifierSummary>;
}

export interface ResponseFilters {
	category: string | null;
	generationIndex: number | null;
	keyword: string;
}
