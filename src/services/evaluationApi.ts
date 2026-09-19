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

export const evaluationApi = {
  list() {
    return api
      .get<Evaluation[] | EvaluationListResponse>("/evaluations")
      .then((res) => {
        return Array.isArray(res.data) ? res.data : (res.data.results ?? []);
      });
  },
  get(id: string) {
    return api.get<Evaluation>(`/evaluations/${id}`).then((res) => res.data);
  },
  create(payload: CreateEvaluationPayload) {
    if (payload.taskFile) {
      const form = new FormData();
      Object.entries(payload).forEach(([key, value]) => {
        if (key === "taskFile") form.append("task_file", value as File);
        else if (value !== undefined) form.append(key, typeof value === "string" ? value : JSON.stringify(value));
      });
      return api.post<Evaluation>("/evaluations", form).then((res) => res.data);
    }
    return api
      .post<Evaluation>("/evaluations", payload)
      .then((res) => res.data);
  },
  update(id: string, payload: Partial<CreateEvaluationPayload>) {
    return api
      .patch<Evaluation>(`/evaluations/${id}`, payload)
      .then((res) => res.data);
  },
  remove(id: string) {
    return api.delete(`/evaluations/${id}`).then((res) => res.data);
  },
};
