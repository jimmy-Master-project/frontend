import { defineStore } from "pinia";
import { ref } from "vue";

import {
  evaluationApi,
  type CreateEvaluationPayload,
} from "@/services/evaluationApi";
import type {
  ClassificationLabel,
  Evaluation,
  EvaluationStatus,
  RecommendationItem,
  TaskType,
  EvaluationLanguage,
  TaskObjective,
} from "@/types";

export const useEvaluationStore = defineStore("evaluation", () => {
  const evaluations = ref<Evaluation[]>([]);

  const evaluationId = ref<string | null>(null);
  const name = ref("");
  const useCaseDescription = ref("");
  const taskType = ref<TaskType>("text_generation");
  const language = ref<EvaluationLanguage>((import.meta.env.VITE_LANGFAIR_DEFAULT_LANGUAGE || "en") as EvaluationLanguage);
  const classificationLabels = ref<ClassificationLabel[]>([]);
  const recommendationItems = ref<RecommendationItem[]>([]);
  const taskObjectives = ref<TaskObjective[]>([]);
  const status = ref<EvaluationStatus>("draft");
  const promptCount = ref(0);

  const loading = ref(false);
  const listLoading = ref(false);
  const error = ref<string | null>(null);

  function setFromEvaluation(evaluation: Evaluation) {
    evaluationId.value = String(evaluation.id);
    name.value = evaluation.name;
    useCaseDescription.value = evaluation.useCaseDescription;
    taskType.value = evaluation.taskType;
    language.value = evaluation.language;
    classificationLabels.value = evaluation.classificationLabels ?? [];
    recommendationItems.value = evaluation.recommendationItems ?? [];
    taskObjectives.value = evaluation.taskObjectives ?? [];
    status.value = evaluation.status;
    promptCount.value = evaluation.promptCount;
  }

  async function fetchEvaluations() {
    listLoading.value = true;
    error.value = null;
    try {
      evaluations.value = await evaluationApi.list();
    } catch (e) {
      error.value = "Failed to load evaluations.";
      throw e;
    } finally {
      listLoading.value = false;
    }
  }

  async function createEvaluation(payload: CreateEvaluationPayload) {
    loading.value = true;
    error.value = null;
    try {
      const evaluation = await evaluationApi.create(payload);
      setFromEvaluation(evaluation);
      return evaluation;
    } catch (e) {
      error.value = "Failed to create evaluation.";
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function fetchEvaluation(id: string | number) {
    loading.value = true;
    error.value = null;
    try {
      const evaluation = await evaluationApi.get(String(id));
      setFromEvaluation(evaluation);
      return evaluation;
    } catch (e) {
      error.value = "Failed to load evaluation.";
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function updateEvaluation(payload: Partial<CreateEvaluationPayload>) {
    if (!evaluationId.value) return;
    loading.value = true;
    error.value = null;
    try {
      const evaluation = await evaluationApi.update(
        evaluationId.value,
        payload,
      );
      setFromEvaluation(evaluation);
      return evaluation;
    } catch (e) {
      error.value = "Failed to update evaluation.";
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function deleteEvaluation(id: string | number) {
    const target = String(id);
    await evaluationApi.remove(target);
    evaluations.value = evaluations.value.filter(
      (evaluation) => String(evaluation.id) !== target,
    );
    if (evaluationId.value === target) reset();
  }

  function reset() {
    evaluationId.value = null;
    name.value = "";
    useCaseDescription.value = "";
    taskType.value = "text_generation";
    language.value = (import.meta.env.VITE_LANGFAIR_DEFAULT_LANGUAGE || "en") as EvaluationLanguage;
    classificationLabels.value = [];
    recommendationItems.value = [];
    taskObjectives.value = [];
    status.value = "draft";
    promptCount.value = 0;
    error.value = null;
  }

  return {
    evaluations,
    evaluationId,
    name,
    useCaseDescription,
    taskType,
    language,
    classificationLabels,
    recommendationItems,
    taskObjectives,
    status,
    promptCount,
    loading,
    listLoading,
    error,
    fetchEvaluations,
    createEvaluation,
    fetchEvaluation,
    updateEvaluation,
    deleteEvaluation,
    reset,
  };
});
