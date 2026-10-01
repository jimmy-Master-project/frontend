import api from "./api";
import type {
  ClassificationLabel,
  Evaluation,
  EvaluationStatus,
  RecommendationItem,
  TaskType,
  EvaluationLanguage,
  TaskObjective,
} from "@/types";

export interface CreateEvaluationPayload {
  name: string;
  useCaseDescription: string;
  taskType: TaskType;
  language: EvaluationLanguage;
  classificationLabels?: ClassificationLabel[];
  recommendationItems?: RecommendationItem[];
  taskObjectives?: TaskObjective[];
  taskFile?: File;
}

interface EvaluationListResponse {
  results?: Evaluation[];
}

export function evaluationPath(
  evaluation: Pick<Evaluation, "id" | "status" | "promptCount">,
) {
  const status = evaluation.status as EvaluationStatus;
  if (status === "completed") return `/evaluations/${evaluation.id}/responses`;
  if (status === "running" || status === "ready")
    return `/evaluations/${evaluation.id}/run`;
  if (status === "prompt_ready") return `/evaluations/${evaluation.id}/llm`;
  return `/evaluations/${evaluation.id}/prompts`;
}

// Backend ids are numbers; route params are strings. Normalize to string so
// comparisons (`===`) work everywhere.
function normalizeEvaluation(evaluation: Evaluation): Evaluation {
  return { ...evaluation, id: String(evaluation.id) };
}

export const evaluationApi = {
  list() {
    return api
      .get<Evaluation[] | EvaluationListResponse>("/evaluations")
      .then((res) => {
        const items = Array.isArray(res.data) ? res.data : (res.data.results ?? []);
        return items.map(normalizeEvaluation);
      });
  },
  get(id: string) {
    return api
      .get<Evaluation>(`/evaluations/${id}`)
      .then((res) => normalizeEvaluation(res.data));
  },
  create(payload: CreateEvaluationPayload) {
    if (payload.taskFile) {
      const form = new FormData();
      Object.entries(payload).forEach(([key, value]) => {
        if (key === "taskFile") form.append("taskFile", value as File);
        else if (value !== undefined) form.append(key, typeof value === "string" ? value : JSON.stringify(value));
      });
      return api
        .post<Evaluation>("/evaluations", form)
        .then((res) => normalizeEvaluation(res.data));
    }
    return api
      .post<Evaluation>("/evaluations", payload)
      .then((res) => normalizeEvaluation(res.data));
  },
  update(id: string, payload: Partial<CreateEvaluationPayload>) {
    return api
      .patch<Evaluation>(`/evaluations/${id}`, payload)
      .then((res) => normalizeEvaluation(res.data));
  },
  remove(id: string) {
    return api.delete(`/evaluations/${id}`).then((res) => res.data);
  },
};
